import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";
import { formatMonth } from "./format";
import { secondaryButton } from "./ui";
import { useLocale } from "./useLocale";

interface Props {
  month: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function MonthNavigator({ month, onPrevious, onNext }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
      <button type="button" className={secondaryButton} aria-label={t("transactions.previousMonth")} onClick={onPrevious}>‹</button>
      <strong data-testid="month-label">{formatMonth(month, locale)}</strong>
      <button type="button" className={secondaryButton} aria-label={t("transactions.nextMonth")} onClick={onNext}>›</button>
    </div>
  );
}
