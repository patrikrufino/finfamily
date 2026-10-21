import { Money } from "@finfamily/domain";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { Modal } from "../../shared/Modal";
import { MoneyText } from "../../shared/MoneyText";
import { formatShortDate } from "../../shared/format";
import { errorText, field, label, primaryButton, secondaryButton } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import type { usePlanViewModel } from "./usePlanViewModel";

interface Props {
  vm: ReturnType<typeof usePlanViewModel>;
  onClose: () => void;
}

const asInput = (cents: number, locale: string) => Money.fromCents(cents).format(locale).replace(/[^\d.,-]/g, "").trim();

export function AnticipateDialog({ vm, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const options = vm.anticipable;
  const [picked, setPicked] = useState<number[]>([]);
  /** Until the user types an amount, the paid amount follows the sum of the picked installments. */
  const [typed, setTyped] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [error, setError] = useState<string | null>(null);

  const nominal = options.filter((i) => picked.includes(i.id)).reduce((s, i) => s + i.amountCents, 0);
  const amountText = typed ?? asInput(nominal, locale);
  const summary = vm.anticipationSummary(picked, amountText);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.anticipate({ installmentIds: picked, amountText, date });
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={t("installments.anticipate")}>
      {options.length === 0 ? (
        <p>{t("installments.nothingToAnticipate")}</p>
      ) : (
        <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
          <fieldset className={css({ display: "grid", gap: "2", border: "none", padding: 0 })}>
            <legend className={label}>{t("installments.pick")}</legend>
            {options.map((i) => (
              <label key={i.id} className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                <input type="checkbox" checked={picked.includes(i.id)} onChange={() => toggle(i.id)} />
                <span>
                  {t("installments.installmentOf", { n: i.installmentNumber })} · {formatShortDate(i.date, locale)} · <MoneyText cents={i.amountCents} />
                </span>
              </label>
            ))}
            <button type="button" className={secondaryButton} onClick={() => setPicked(options.map((i) => i.id))}>
              {t("installments.settleAll")}
            </button>
          </fieldset>

          <div>
            <label htmlFor="ant-amount" className={label}>{t("installments.amountPaid")}</label>
            <input id="ant-amount" className={field} inputMode="decimal" value={amountText} onChange={(e) => setTyped(e.target.value)} />
            <p className={css({ color: "muted", fontSize: "xs", marginTop: "1" })}>{t("installments.anticipationHint")}</p>
          </div>
          <div>
            <label htmlFor="ant-date" className={label}>{t("installments.paymentDate")}</label>
            <input id="ant-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <p data-testid="anticipation-summary" className={css({ fontSize: "sm" })}>
            {t("installments.nominal")}: <MoneyText cents={summary.nominalCents} />
            {summary.savingCents !== null && summary.savingCents > 0 && (
              <> · {t("installments.saving")}: <MoneyText cents={summary.savingCents} /></>
            )}
          </p>
          {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
          <button type="submit" className={primaryButton}>{t("installments.anticipate")}</button>
        </form>
      )}
    </Modal>
  );
}
