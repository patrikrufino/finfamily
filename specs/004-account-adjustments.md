# Account initial balance and balance adjustments

## Context
The initial balance of an account can be wrong or change when the household starts tracking, and real balances drift from the app over time.

## Rules
- The initial balance of an account can be edited at any time. It changes the balance directly; no transaction is created.
- "Adjust balance" takes the balance the user sees in the bank and compares it with the app's current balance (settled transactions only).
  The difference becomes an **adjustment transaction**: income when the real balance is higher, expense when it is lower.
- An adjustment is a normal income/expense on the account (so it keeps the balance consistent), flagged as an adjustment, with the default
  description "Ajuste de saldo" and the person who made it.
- Adjustments are **not** spending or earning: they are excluded from the budget and from the month's income/expense totals.
- If there is no difference, nothing is created.

## Acceptance criteria
### Edit initial balance
- **Given** an account with initial R$ 1.000,00 and no transactions **When** the initial balance is changed to R$ 1.500,00 **Then** the balance is R$ 1.500,00.

### Adjust down
- **Given** a balance of R$ 1.000,00 **When** the user adjusts to R$ 920,00 **Then** an adjustment expense of R$ 80,00 is created and the balance is R$ 920,00.

### Adjust up
- **Given** a balance of R$ 1.000,00 **When** the user adjusts to R$ 1.050,00 **Then** an adjustment income of R$ 50,00 is created.

### Not spending
- **Given** an adjustment expense **Then** the budget spent total and the month's expense total do not change.

### Nothing to adjust
- **Given** the target equals the current balance **Then** the request is rejected with `no_adjustment_needed`.

## Out of scope
Adjusting card statements, reconciling with bank files.
