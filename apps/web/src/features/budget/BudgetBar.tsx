import type { BudgetStatus } from "@finfamily/domain";
import { css } from "../../../styled-system/css";

const COLORS: Record<BudgetStatus, string> = {
  none: "border",
  ok: "primary",
  warning: "orange.400",
  over: "red.500",
};

export function BudgetBar({ ratio, status, label }: { ratio: number; status: BudgetStatus; label: string }) {
  const percent = Math.min(100, Math.round(ratio * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={css({ height: "2", borderRadius: "full", background: "border", overflow: "hidden" })}
    >
      <div className={css({ height: "100%", background: COLORS[status] })} style={{ width: `${percent}%` }} />
    </div>
  );
}
