import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepository } from "../../data/RepositoryContext";
import type { CategoryDto, NewCategory } from "../../data/types";
import type { CommandResult } from "../accounts/useAccountsViewModel";
import { errorCode } from "../cards/useCardsViewModel";

export function useCategoriesViewModel() {
  const repository = useRepository();
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["categories"], queryFn: () => repository.listCategories() });
  const refresh = () => {
    for (const key of ["categories", "budget", "dashboard"]) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const create = useMutation({ mutationFn: (input: NewCategory) => repository.createCategory(input), onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof repository.updateCategory>[1] }) => repository.updateCategory(id, patch),
    onSuccess: refresh,
  });
  const defaults = useMutation({ mutationFn: () => repository.addDefaultCategories(), onSuccess: refresh });

  const categories = query.data ?? [];

  async function run(action: () => Promise<unknown>): Promise<CommandResult> {
    try {
      await action();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorCode(e) };
    }
  }

  return {
    isLoading: query.isLoading,
    expense: categories.filter((c) => c.kind === "expense"),
    income: categories.filter((c) => c.kind === "income"),

    async createCategory(input: { name: string; kind: CategoryDto["kind"]; icon: string | null }): Promise<CommandResult> {
      const name = input.name.trim();
      if (!name) return { ok: false, error: "name_required" };
      return run(() => create.mutateAsync({ name, kind: input.kind, icon: input.icon }));
    },

    /** The kind of a category never changes, only its name and icon. */
    async updateCategory(id: number, input: { name: string; icon: string | null }): Promise<CommandResult> {
      const name = input.name.trim();
      if (!name) return { ok: false, error: "name_required" };
      return run(() => update.mutateAsync({ id, patch: { name, icon: input.icon } }));
    },

    archiveCategory: (id: number) => update.mutateAsync({ id, patch: { archived: true } }).then(() => undefined),

    async addDefaults(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
      try {
        const { created } = await defaults.mutateAsync();
        return { ok: true, created };
      } catch (e) {
        return { ok: false, error: errorCode(e) };
      }
    },
  };
}
