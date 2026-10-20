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
