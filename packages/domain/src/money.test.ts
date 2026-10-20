import { describe, expect, it } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("stores amounts as integer cents", () => {
    expect(Money.fromCents(1050).cents).toBe(1050);
  });

  it("rejects non-integer cents", () => {
    expect(() => Money.fromCents(10.5)).toThrow();
  });

  it("parses a decimal amount into cents without float drift", () => {
    expect(Money.fromDecimal(19.99).cents).toBe(1999);
    expect(Money.fromDecimal(0.1 + 0.2).cents).toBe(30);
  });

  it("adds and subtracts", () => {
    const a = Money.fromCents(1000);
    const b = Money.fromCents(250);
    expect(a.add(b).cents).toBe(1250);
    expect(a.subtract(b).cents).toBe(750);
  });

  it("splits into installments putting the remainder on the last one", () => {
    const parts = Money.fromCents(10000).split(3);
    expect(parts.map((p) => p.cents)).toEqual([3333, 3333, 3334]);
    expect(parts.reduce((s, p) => s + p.cents, 0)).toBe(10000);
  });

  it("rejects splitting into fewer than one part", () => {
    expect(() => Money.fromCents(100).split(0)).toThrow();
  });

  it("formats according to the given locale", () => {
    const text = Money.fromCents(123456).format("pt-BR");
    expect(text.replace(/ /g, " ")).toBe("R$ 1.234,56");
  });

  it("formats negative values", () => {
    const text = Money.fromCents(-500).format("pt-BR").replace(/ /g, " ");
    expect(text).toBe("-R$ 5,00");
  });

  describe("parse", () => {
    it("parses pt-BR input", () => {
      expect(Money.parse("1.234,56", "pt-BR")?.cents).toBe(123456);
      expect(Money.parse("R$ 10,5", "pt-BR")?.cents).toBe(1050);
      expect(Money.parse("7", "pt-BR")?.cents).toBe(700);
      expect(Money.parse("-12,30", "pt-BR")?.cents).toBe(-1230);
    });

    it("parses en input", () => {
      expect(Money.parse("1,234.56", "en")?.cents).toBe(123456);
    });

    it("returns null for invalid input", () => {
      expect(Money.parse("", "pt-BR")).toBeNull();
      expect(Money.parse("abc", "pt-BR")).toBeNull();
      expect(Money.parse("1,2,3", "pt-BR")).toBeNull();
      expect(Money.parse("1,234", "pt-BR")?.cents).toBeUndefined();
    });
  });
});
