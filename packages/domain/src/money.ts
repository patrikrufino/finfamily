export const DEFAULT_LOCALE = "pt-BR";
export const DEFAULT_CURRENCY = "BRL";

export class Money {
  private constructor(readonly cents: number) {}

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new RangeError(`Money cents must be an integer, received ${cents}`);
    }
    return new Money(cents);
  }

  static fromDecimal(amount: number): Money {
    return new Money(Math.round(amount * 100));
  }

  /**
   * Parses user-typed text using the locale's separators. Returns null when invalid.
   * Accepts at most 2 decimal digits and ignores currency symbols and spaces.
   */
  static parse(text: string, locale: string = DEFAULT_LOCALE): Money | null {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.8);
    const group = parts.find((p) => p.type === "group")?.value ?? ",";
    const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
    const cleaned = text.replace(/[^\d\-.,]/g, "").split(group).join("");
    const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(cleaned.split(decimal).join("."));
    if (!match) return null;
    const [, sign, whole, fraction = ""] = match;
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    return new Money(sign ? -cents : cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  negate(): Money {
    return new Money(-this.cents);
  }

  /** Splits into `parts` amounts; the remainder goes to the last one. */
  split(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts < 1) {
      throw new RangeError(`Cannot split into ${parts} parts`);
    }
    const base = Math.trunc(this.cents / parts);
    const remainder = this.cents - base * parts;
    return Array.from({ length: parts }, (_, i) =>
      new Money(i === parts - 1 ? base + remainder : base),
    );
  }

  format(locale: string = DEFAULT_LOCALE, currency: string = DEFAULT_CURRENCY): string {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(this.cents / 100);
  }
}
