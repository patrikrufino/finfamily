import { css } from "../../styled-system/css";

export const field = css({
  width: "100%",
  padding: "3",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border",
  background: "surface",
  color: "text",
  fontSize: "md",
});

export const label = css({ display: "block", fontSize: "sm", color: "muted", marginBottom: "1" });

export const primaryButton = css({
  padding: "3",
  borderRadius: "md",
  background: "primary",
  color: "onPrimary",
  fontWeight: "bold",
  cursor: "pointer",
  "&:disabled": { opacity: 0.6 },
});

export const secondaryButton = css({
  padding: "3",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border",
  background: "surface",
  color: "text",
  cursor: "pointer",
});

export const dangerButton = css({
  padding: "3",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "red.500",
  background: "transparent",
  color: "red.500",
  cursor: "pointer",
});

export const card = css({
  background: "surface",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "lg",
  padding: "4",
});

export const errorText = css({ color: "red.500", fontSize: "sm" });
