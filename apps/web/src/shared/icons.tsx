import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

/** Outline icons (24px grid, 2px stroke) drawn for the bottom navigation. Decorative: the label carries the meaning. */
function Icon({ size = 24, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);

export const ReceiptIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6" />
  </Icon>
);

export const PieIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12A9 9 0 1 1 12 3" />
    <path d="M12 3v9h9" />
  </Icon>
);

export const CardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18M7 15h3" />
  </Icon>
);

export const BankIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10 12 4l9 6H3z" />
    <path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
