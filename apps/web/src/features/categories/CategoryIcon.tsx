import { css } from "../../../styled-system/css";

const FALLBACK = "🏷️";

/** The category's icon in a soft round badge. Decorative: the name next to it carries the meaning. */
export function CategoryIcon({ icon }: { icon: string | null }) {
  return (
    <span
      aria-hidden="true"
      className={css({
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: "9",
        height: "9",
        borderRadius: "full",
        background: "primary/15",
        fontSize: "lg",
        lineHeight: "1",
      })}
    >
      {icon ?? FALLBACK}
    </span>
  );
}

/** `🛒 Mercado` for places that only take plain text (select options, subtitles). */
export const categoryLabel = (c: { name: string; icon: string | null }) => (c.icon ? `${c.icon} ${c.name}` : c.name);
