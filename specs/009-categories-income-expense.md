# Categories: income and expense, with icons

## Context
A category is either for **income** or for **expenses**, never both. Each category has an icon picked from a fixed list, and the app comes with a basic set.

## Rules
- A category has a name, a kind (`income` | `expense`), an icon (optional) and an archived flag. The kind is chosen at creation and never changes.
- An income transaction (or recurring income) can only use an income category; an expense (card purchases, installments, debt payments, recurring expenses, interest/fines)
  only an expense category; transfers and balance adjustments use none.
- Names are unique among the **active categories of the same kind**, ignoring case: "Outros" can exist as an expense and as an income, but not twice as an expense.
- Budgets exist only for expense categories. The budget screen and report list only expense categories; income categories have no budget.
- The icon comes from a curated list (grouped by theme). A value outside the list is rejected. The picker shows the list; picking is optional.
- Categories are archived, never deleted; archived ones keep their history and disappear from pickers.
- **Defaults** (created once on a brand new database, and available on demand as "add default categories", which only adds what is missing by name and kind):
  - Income: Salário, Projetos, Outras receitas.
  - Expenses: Moradia, Assinaturas, Carro, Transporte, Mercado, Comida fora, Cuidados pessoais, Educação, Vestuário, Saúde, Dívidas, Outros.
- **Migration of existing data**: a category of the old kind `both` becomes an expense category; if income already used it, an income category with the same name and icon is created and the
  income transactions and recurring income are moved to it. Nothing is lost.

## Acceptance criteria
### Separation
- **When** an income uses an expense category (or the other way around) **Then** it is rejected with `category_not_allowed`.

### Names per kind
- **Given** the expense "Outros" **Then** creating the income "Outros" works and a second expense "outros" is rejected.

### Budget
- **When** a budget is set on an income category **Then** it is rejected, and income categories never appear in the budget report.

### Icons
- **When** a category is created with an icon outside the list **Then** it is rejected.

### Defaults
- **Given** an empty database **Then** the 17 default categories exist after the first start.
- **When** "add defaults" runs twice **Then** nothing is duplicated, and categories the user already has (same name and kind) are kept.

### Migration
- **Given** a `both` category "Salary" used by income and by expenses **Then** after the migration the expenses stay on the expense "Salary" and the income moves to a new income "Salary".

## Out of scope
Custom icon upload, subcategories, colors.
