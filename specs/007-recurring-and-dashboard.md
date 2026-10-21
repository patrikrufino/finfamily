# Recurring transactions, dashboard and forecast

## Context
Salary, rent and subscriptions repeat. The dashboard answers "where do we stand now, how is the month against the budget, and what is coming?".

## Recurring rules
- A rule has: kind (`income` | `expense`), amount, description, source (an account **or**, for expenses, a card), optional category, the person, a frequency
  (`weekly` | `monthly` | `yearly`), a start date, an optional end date and an active flag.
- Occurrence `i` (0-based) is dated: weekly `start + 7i` days; monthly `start + i` months and yearly `start + 12i` months, keeping the day of the month
  clamped to the month's last day (31 Jan, 28 Feb, 31 Mar).
- Occurrences are posted as **real settled transactions** when their date arrives (automatically, once each, never twice). A rule created with a
  start date in the past does **not** backfill: posting starts from the first occurrence that is today or later.
- Occurrences on a card are card purchases (they fall in the statement of their date). Income must go to an account.
- Pausing a rule stops posting; resuming continues from the next occurrence that is today or later (no backfill). Editing a rule changes future occurrences only.
- A rule that has already posted transactions is paused or ended, never deleted; a rule without postings can be deleted.
- Posted transactions are normal transactions (editable, deletable); each remembers its rule.

## Dashboard (home)
- **Current balance** (settled) and the **projected** balance at the end of the month.
- **Month result**: income, expenses and the difference of the current month. Settled transactions only; transfers and balance adjustments are not income or expense;
  card purchases count on the purchase date; interest/fines count as expenses.
- **Budget of the month**: budgeted vs spent in total, and the categories that are near the limit or over it.
- **Card statements due** in the next 30 days (and overdue ones), with what remains to pay.
- **Debts**: total owed. **Installments**: what is committed in the current month.

## Forecast (next months)
- Starts from the current settled balance and projects each month (the current one from tomorrow on) with:
  - scheduled income/expenses on accounts (this includes future installments paid from an account) and future recurring occurrences on accounts;
  - **card statements** leaving the account on their **due date**: the unpaid part of every statement (purchases already made, future installments and future recurring
    charges on the card, minus what was paid). A statement already due and unpaid counts in the current month.
- Per month: income, expenses, card payments, net and the projected end balance.
- Debts have no schedule, so they are not part of the forecast.

## Acceptance criteria
### Occurrences
- **Given** a monthly rule starting 2026-01-31 **Then** occurrences are 01-31, 02-28, 03-31, 04-30.

### No backfill
- **Given** a monthly rule starting 2026-01-15 created on 2026-10-20 **Then** the first posting is 2026-11-15 and nothing is posted for earlier months.

### Posted once
- **When** the date of an occurrence arrives **Then** exactly one settled transaction is created, even if the system is queried many times.

### Forecast
- **Given** balance R$ 1.000,00, a monthly salary of R$ 3.000,00 on the 5th and rent of R$ 1.200,00 on the 10th **Then** the next month ends at R$ 1.000,00 + 1.800,00 (relative to the previous end).
- **Given** a card statement of R$ 800,00 due next month **Then** next month has a card payment of R$ 800,00.
- **Given** an unpaid statement already past its due date **Then** it counts in the current month.

### Month result
- **Given** an adjustment, a transfer and a card payment **Then** none of them count as income or expense.

## Out of scope
Rules with custom intervals, per-occurrence edits that detach from the rule, forecast of debts, notifications.
