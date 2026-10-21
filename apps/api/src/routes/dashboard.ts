import {
  Money,
  accountBalance,
  addDays,
  buildForecast,
  buildStatement,
  monthOf,
  monthSummary,
  statementMonthFor,
  summarizeDebt,
  type Card,
  type CycleRule,
  type Debt,
  type DebtEntry,
  type RecurringRule,
  type Transaction,
} from "@finfamily/domain";
import { Hono } from "hono";
import type { AppDatabase } from "../db/client";
import { accounts, cardCycleRules, cards, debtEntries, debts, recurringRules, transactions } from "../db/schema";
import { toDomainAccount, toDomainTransaction } from "../mappers";
import { budgetReport } from "./budget";

const FORECAST_MONTHS = 6;
const DUE_WINDOW_DAYS = 30;
const MAX_HIGHLIGHTS = 5;

export function dashboardRoutes(db: AppDatabase, today: () => string) {
  const app = new Hono();

  app.get("/", (c) => {
    const now = today();
    const month = monthOf(now);
    const txs: Transaction[] = db.select().from(transactions).all().map(toDomainTransaction);

    const activeAccounts = db.select().from(accounts).all().filter((a) => !a.archived);
    const balanceCents = activeAccounts.reduce((s, a) => s + accountBalance(toDomainAccount(a), txs).cents, 0);

    const cardList: Card[] = db.select().from(cards).all()
      .map((r) => ({ id: r.id, name: r.name, limit: Money.fromCents(r.limitCents), archived: r.archived }));
    const cycleRules: CycleRule[] = db.select().from(cardCycleRules).all();
    const recurring: RecurringRule[] = db.select().from(recurringRules).all().map((r) => ({
      id: r.id, kind: r.kind, amount: Money.fromCents(r.amountCents), description: r.description, accountId: r.accountId,
      cardId: r.cardId, categoryId: r.categoryId, personId: r.personId, frequency: r.frequency, startDate: r.startDate,
      endDate: r.endDate, nextIndex: r.nextIndex, active: r.active,
    }));

    const forecast = buildForecast({
      today: now, months: FORECAST_MONTHS, startingBalanceCents: balanceCents, transactions: txs, cards: cardList, cycleRules, recurring,
    });

    const budget = budgetReport(db, month);
    const highlights = budget.categories
      .filter((cat) => cat.status === "warning" || cat.status === "over")
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, MAX_HIGHLIGHTS)
      .map(({ categoryId, name, icon, status, ratio, budgetCents, spentCents, remainingCents }) => ({
        categoryId, name, icon, status, ratio, budgetCents, spentCents, remainingCents,
      }));

    // Unpaid statements already due or due within the next 30 days.
    const limit = addDays(now, DUE_WINDOW_DAYS);
    const cardsDue = cardList.filter((card) => !card.archived).flatMap((card) => {
      const rules = cycleRules.filter((r) => r.cardId === card.id);
      if (rules.length === 0) return [];
      const months = new Set(
        txs.filter((t) => t.cardId === card.id && t.kind === "expense" && t.accountId === null).map((t) => statementMonthFor(rules, t.date)),
      );
      return [...months].flatMap((m) => {
        const s = buildStatement(card, rules, txs, m, now);
        if (s.remainingCents <= 0 || s.dueDate > limit) return [];
        return [{
          cardId: card.id, name: card.name, month: m, dueDate: s.dueDate, remainingCents: s.remainingCents,
          status: s.status, overdue: s.dueDate < now,
        }];
      });
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));

    const entries: DebtEntry[] = db.select().from(debtEntries).all()
      .map((e) => ({ id: e.id, debtId: e.debtId, kind: e.kind, amount: Money.fromCents(e.amountCents), date: e.date, note: e.note }));
    const openDebts = db.select().from(debts).all()
      .map((d): Debt => ({ id: d.id, creditor: d.creditor, original: Money.fromCents(d.originalCents), openedOn: d.openedOn }))
      .map((d) => summarizeDebt(d, entries, txs))
      .filter((s) => s.status === "open");

    const scheduledInstallments = txs.filter((t) => t.planId != null && t.installmentNumber != null && t.status === "scheduled");
    const committedThisMonthCents = scheduledInstallments.filter((t) => monthOf(t.date) === month).reduce((s, t) => s + t.amount.cents, 0);

    return c.json({
      today: now,
      month,
      balanceCents,
      projectedEndOfMonthCents: forecast[0]?.endBalanceCents ?? balanceCents,
      monthSummary: monthSummary(txs, month),
      budget: { totals: budget.totals, highlights },
      cardsDue,
      debts: { totalOwedCents: openDebts.reduce((s, d) => s + d.balanceCents, 0), openCount: openDebts.length },
      installments: {
        committedThisMonthCents,
        activePlans: new Set(scheduledInstallments.map((t) => t.planId)).size,
      },
      forecast,
    });
  });

  return app;
}
