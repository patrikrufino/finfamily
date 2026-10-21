import { Money } from "@finfamily/domain";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { useRepository } from "../../data/RepositoryContext";
import type { StatementDto } from "../../data/types";
import { Modal } from "../../shared/Modal";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import type { useStatementViewModel } from "./useStatementViewModel";

interface Props {
  statement: StatementDto;
  vm: ReturnType<typeof useStatementViewModel>;
  onClose: () => void;
}

export function PayStatementDialog({ statement, vm, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const repository = useRepository();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => repository.listAccounts() }).data ?? [];
  const [accountId, setAccountId] = useState<number | null>(null);
  const [amountText, setAmount] = useState(
    Money.fromCents(Math.max(statement.remainingCents, 0)).format(locale).replace(/[^\d.,-]/g, "").trim(),
  );
  const [interestText, setInterest] = useState("");
  const [fineText, setFine] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [error, setError] = useState<string | null>(null);
  const selected = accountId ?? accounts[0]?.id ?? null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (selected === null) return setError("account_required");
    const result = await vm.pay({ accountId: selected, amountText, interestText, fineText, date });
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={t("cards.pay")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <div>
          <label htmlFor="pay-account" className={label}>{t("cards.payFrom")}</label>
          <select id="pay-account" className={field} value={selected ?? ""} onChange={(e) => setAccountId(Number(e.target.value))}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pay-amount" className={label}>{t("cards.amount")}</label>
          <input id="pay-amount" className={field} inputMode="decimal" value={amountText} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3" })}>
          <div>
            <label htmlFor="pay-interest" className={label}>{t("cards.interest")}</label>
            <input id="pay-interest" className={field} inputMode="decimal" placeholder="0,00" value={interestText} onChange={(e) => setInterest(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pay-fine" className={label}>{t("cards.fine")}</label>
            <input id="pay-fine" className={field} inputMode="decimal" placeholder="0,00" value={fineText} onChange={(e) => setFine(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="pay-date" className={label}>{t("cards.date")}</label>
          <input id="pay-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
