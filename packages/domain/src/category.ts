import type { TransactionKind } from "./transaction";

export const CATEGORY_KINDS = ["expense", "both"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  archived: boolean;
}

export function categoryAllows(category: Category, transactionKind: TransactionKind): boolean {
  if (transactionKind === "transfer") return false;
  if (transactionKind === "income") return category.kind === "both";
  return true;
}
