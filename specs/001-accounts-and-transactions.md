# Accounts and transactions

## Context
The household needs several accounts of different types and a way to record income, expenses and transfers between them.

## Rules
- Account types: `checking`, `savings`, `wallet`, `investment`.
- An account has a name (unique among active accounts), a type and an initial balance (cents, may be negative).
- Accounts are archived, never deleted. Archived accounts keep their history and are hidden from pickers.
- A transaction has: kind (`income` | `expense` | `transfer`), positive amount in cents, date (`YYYY-MM-DD`),
  account, optional destination account (transfers only), description, status (`settled` | `scheduled`) and the person who made it.
- A transfer needs a destination different from the source account; income/expense must not have one.
- Balance = initial balance + settled income - settled expenses + settled transfers in - settled transfers out.
- Scheduled transactions do not change the current balance; they appear in the projected balance.
- Transactions can be listed by month, account and person, newest first.
- Categories are not part of this phase (Phase 2 adds them to transactions).

## Acceptance criteria
### Balance
- **Given** an account with initial R$ 1.000,00, a settled income of R$ 500,00 and a settled expense of R$ 200,00
  **Then** the balance is R$ 1.300,00.

### Scheduled does not count
- **Given** a scheduled expense of R$ 100,00 **Then** the balance is unchanged and the projected balance is reduced by R$ 100,00.

### Transfer
- **Given** a settled transfer of R$ 300,00 from Checking to Savings **Then** Checking drops by R$ 300,00 and Savings rises by R$ 300,00, and the total across accounts is unchanged.

### Validation
- **When** the amount is zero or negative **Then** the transaction is rejected.
- **When** a transfer has the same source and destination **Then** it is rejected.

### Archive
- **Given** an archived account **Then** it is not listed by default but its transactions remain.

### Mobile flow
- **When** the user taps "Novo lançamento", fills the form and saves **Then** the transaction appears in the month list and the account balance updates.

## Out of scope
Categories, budgets, credit cards, installments, debts, recurring transactions.
