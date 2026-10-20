import { Money } from "@finfamily/domain";
import { useLocale } from "./useLocale";

export function MoneyText({ cents, className }: { cents: number; className?: string }) {
  const locale = useLocale();
  return <span className={className}>{Money.fromCents(cents).format(locale)}</span>;
}
