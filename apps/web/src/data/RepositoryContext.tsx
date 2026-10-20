import { createContext, useContext, type ReactNode } from "react";
import { httpRepository } from "./httpRepository";
import type { FinanceRepository } from "./types";

const RepositoryContext = createContext<FinanceRepository>(httpRepository);

export function RepositoryProvider({ repository, children }: { repository: FinanceRepository; children: ReactNode }) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

export const useRepository = () => useContext(RepositoryContext);
