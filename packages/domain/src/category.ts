import type { TransactionKind } from "./transaction";

/** A category is for income or for expenses, never both. The kind is fixed when it is created. */
export const CATEGORY_KINDS = ["expense", "income"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  /** One of `CATEGORY_ICONS`, or null. */
  icon: string | null;
  archived: boolean;
}

/** An income uses income categories, an expense uses expense categories, transfers use none. */
export function categoryAllows(category: Category, transactionKind: TransactionKind): boolean {
  return transactionKind !== "transfer" && category.kind === transactionKind;
}

/** Icons offered by the picker, grouped by theme. The group ids are translation keys. */
export const CATEGORY_ICON_GROUPS: readonly { id: string; icons: readonly string[] }[] = [
  { id: "money", icons: ["💰", "💵", "💳", "🏦", "📈", "💼", "💻", "🤝", "🎁", "🪙"] },
  { id: "home", icons: ["🏠", "🔑", "💡", "🚿", "🛋️", "🧹", "🔧", "🌐"] },
  { id: "bills", icons: ["📺", "🎵", "📱", "☁️", "🎮", "📰", "🧾", "📜"] },
  { id: "vehicle", icons: ["🚗", "⛽", "🅿️", "🚘", "🛞", "🔋"] },
  { id: "transport", icons: ["🚌", "🚇", "🚕", "✈️", "🚲", "🛵", "🚆"] },
  { id: "food", icons: ["🛒", "🍽️", "🍔", "☕", "🍕", "🥖", "🍷", "🍎"] },
  { id: "care", icons: ["💇", "💅", "🧴", "🪒", "🧼"] },
  { id: "education", icons: ["🎓", "📚", "✏️", "🧑‍🏫", "🧠"] },
  { id: "clothing", icons: ["👕", "👟", "👗", "🧥", "👜"] },
  { id: "health", icons: ["🩺", "💊", "🏥", "🦷", "🧘", "🏋️"] },
  { id: "leisure", icons: ["🎬", "🎉", "🏖️", "🎟️", "🎨", "⚽"] },
  { id: "family", icons: ["👶", "🐶", "🐱", "🎒", "👨‍👩‍👧"] },
  { id: "debts", icons: ["📉", "⚠️", "🏷️", "🧮"] },
  { id: "misc", icons: ["📦", "⭐", "❓", "🧩", "🔖"] },
];

export const CATEGORY_ICONS: readonly string[] = CATEGORY_ICON_GROUPS.flatMap((g) => g.icons);

export function isCategoryIcon(value: string): boolean {
  return CATEGORY_ICONS.includes(value);
}

export interface DefaultCategory {
  name: string;
  kind: CategoryKind;
  icon: string;
}

/** Created once on a brand new database; "add default categories" adds whatever is missing by name and kind. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Salário", kind: "income", icon: "💼" },
  { name: "Projetos", kind: "income", icon: "💻" },
  { name: "Outras receitas", kind: "income", icon: "💰" },
  { name: "Moradia", kind: "expense", icon: "🏠" },
  { name: "Assinaturas", kind: "expense", icon: "📺" },
  { name: "Carro", kind: "expense", icon: "🚗" },
  { name: "Transporte", kind: "expense", icon: "🚌" },
  { name: "Mercado", kind: "expense", icon: "🛒" },
  { name: "Comida fora", kind: "expense", icon: "🍽️" },
  { name: "Cuidados pessoais", kind: "expense", icon: "💇" },
  { name: "Educação", kind: "expense", icon: "🎓" },
  { name: "Vestuário", kind: "expense", icon: "👕" },
  { name: "Saúde", kind: "expense", icon: "🩺" },
  { name: "Dívidas", kind: "expense", icon: "📉" },
  { name: "Outros", kind: "expense", icon: "📦" },
];
