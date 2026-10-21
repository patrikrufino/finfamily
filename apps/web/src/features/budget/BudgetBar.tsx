import type { BudgetStatus } from "@finfamily/domain";
import { css } from "../../../styled-system/css";

// Each css() call is written out literally so Panda's static extraction generates every color.
const FILL: Record<BudgetStatus, string> = {
  none: css({ height: "100%", background: "border" }),
  ok: css({ height: "100%", background: "primary" }),
  warning: css({ height: "100%", background: "orange.400" }),
  over: css({ height: "100%", background: "red.500" }),
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
      <div className={FILL[status]} style={{ width: `${percent}%` }} />
    </div>
  );
}
