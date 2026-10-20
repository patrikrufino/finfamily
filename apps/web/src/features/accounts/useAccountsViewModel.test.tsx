import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useAccountsViewModel } from "./useAccountsViewModel";

const seeded = () =>
  createFakeRepository({
    accounts: [
      { name: "Checking", type: "checking", initialBalanceCents: 100000 },
      { name: "Savings", type: "savings", initialBalanceCents: 50000 },
    ],
  });

describe("useAccountsViewModel", () => {
  it("loads accounts and totals the balance", async () => {
    const { result } = renderHookWithProviders(() => useAccountsViewModel(), seeded());
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    expect(result.current.totalBalanceCents).toBe(150000);
  });

  it("creates an account from typed text", async () => {
    const { result } = renderHookWithProviders(() => useAccountsViewModel(), seeded());
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    await act(() => result.current.createAccount({ name: "Wallet", type: "wallet", initialBalanceText: "1.234,56" }));
    await waitFor(() => expect(result.current.accounts).toHaveLength(3));
    expect(result.current.accounts.find((a) => a.name === "Wallet")?.balanceCents).toBe(123456);
  });

  it("reports an invalid initial balance without calling the API", async () => {
    const repo = seeded();
    const { result } = renderHookWithProviders(() => useAccountsViewModel(), repo);
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createAccount({ name: "X", type: "wallet", initialBalanceText: "abc" });
    });
    expect(outcome).toEqual({ ok: false, error: "invalid_amount" });
    expect(repo.calls).not.toContain("createAccount");
  });

  it("surfaces duplicate names", async () => {
    const { result } = renderHookWithProviders(() => useAccountsViewModel(), seeded());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createAccount({ name: "Checking", type: "checking", initialBalanceText: "0" });
    });
    expect(outcome).toEqual({ ok: false, error: "account_name_taken" });
  });

  it("archives an account", async () => {
    const { result } = renderHookWithProviders(() => useAccountsViewModel(), seeded());
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    await act(() => result.current.archiveAccount(1));
    await waitFor(() => expect(result.current.accounts).toHaveLength(1));
  });
});
