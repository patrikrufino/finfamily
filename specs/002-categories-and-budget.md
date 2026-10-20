# Categories and budget

## Context
Transactions get categories, and each expense category can have a fixed monthly budget compared with what was actually spent.

## Rules
- A category has a name (unique among active ones) and a kind: `expense` (expenses only) or `both` (expenses and income).
- Categories are archived, never deleted. Archived categories keep their history and are hidden from pickers.
- A transaction may have a category (optional). Transfers never have one. Income needs a category of kind `both`.
- Budget is a fixed monthly amount per category, expenses only, with no rollover: every month starts from zero.
- A budget has a validity month: changing it applies from the chosen month onward and never alters earlier months.
  The amount for a month is the latest entry whose month is not after it. An amount of zero means "no budget".
- Spent in a month = sum of **settled** expenses of the category dated in that month.
  Scheduled expenses are reported separately as committed.
- Remaining = budget - spent (negative when over budget).
- Status: `none` (no budget), `ok` (< 80% spent), `warning` (80% to 100%), `over` (> 100%).
- Expenses without a category are reported as "uncategorized" and have no budget.

## Acceptance criteria
### Budget progress
- **Given** a budget of R$ 500,00 and settled expenses of R$ 450,00 in the month **Then** remaining is R$ 50,00 and status is `warning`.
- **Given** settled expenses of R$ 520,00 **Then** remaining is -R$ 20,00 and status is `over`.

### Validity
- **Given** a budget of R$ 400,00 from 2026-01 and R$ 600,00 from 2026-07 **Then** 2026-06 uses R$ 400,00 and 2026-07 uses R$ 600,00.

### Category rules
- **When** an income uses an expense-only category **Then** it is rejected.
- **When** a transfer has a category **Then** it is rejected.

### Mobile flow
- **When** the user creates "Mercado" with a R$ 800,00 budget and registers a R$ 200,00 expense in it
  **Then** the Budget screen shows 25% used and R$ 600,00 remaining.

## Out of scope
Rollover, income goals, category icons/colors, credit cards.
