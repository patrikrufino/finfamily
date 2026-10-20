import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { RepositoryProvider } from "../data/RepositoryContext";
import type { FinanceRepository } from "../data/types";
import { createFakeRepository } from "./fakeRepository";

function wrapper(repository: FinanceRepository, path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <RepositoryProvider repository={repository}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </RepositoryProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, repository: FinanceRepository = createFakeRepository(), path = "/") {
  return render(ui, { wrapper: wrapper(repository, path) });
}

export function renderHookWithProviders<T>(hook: () => T, repository: FinanceRepository = createFakeRepository()) {
  return renderHook(hook, { wrapper: wrapper(repository) });
}
