import { useQuery } from "@tanstack/react-query";
import { useRepository } from "../../data/RepositoryContext";

export function useInstallmentsViewModel() {
  const repository = useRepository();
  const query = useQuery({ queryKey: ["plans"], queryFn: () => repository.listPlans() });
  const plans = query.data ?? [];
  return {
    plans,
    active: plans.filter((p) => p.status === "active"),
    done: plans.filter((p) => p.status === "done"),
    isLoading: query.isLoading,
  };
}
