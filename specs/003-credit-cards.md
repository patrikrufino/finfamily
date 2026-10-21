# Credit cards, statements and closing

## Context
Purchases on a credit card do not touch an account balance. They accumulate in a statement (fatura) that is paid later from an account.

## Rules
- A card has a name, a limit (cents) and cycle rules: closing day and due day, each with a validity month.
- The statement for month `M` **closes** on the closing day of `M` (clamped to the month's last day). It covers purchases from the day after the
  previous statement's closing date up to and **including** the closing date.
  A purchase made on the closing day belongs to the current statement.
- The **due date** is the due day in month `M` if the due day is after the closing day, otherwise in month `M+1` (clamped to the month's last day).
- Cycle rules apply from a validity month: the rule for statement `M` is the latest one whose month is not after `M`. A new rule can only start at or
  after the statement that is currently open, so closed statements never change.
- A card purchase is an `expense` with a card and **no account**. It counts in the category budget on the purchase date but does not change any account balance.
- Statement total = sum of the purchases that fall in it. Paid = sum of payments made for it. Remaining = total - paid.
- Status: `open` (today is not after the closing date), `closed` (closed and remaining > 0), `paid` (closed and remaining <= 0).
- Paying a statement creates a transfer from an account to the card for that statement (it reduces the account balance and is **not** an expense).
  Interest and fine, when informed, are recorded as **separate expense items** on the same account, linked to the statement.
- Used limit = all purchases - all payments. Available limit = limit - used.
- Cards are archived, never deleted.

## Acceptance criteria
### Closing day belongs to the current statement
- **Given** closing day 25 **Then** a purchase on 2026-10-25 is in the 2026-10 statement and one on 2026-10-26 is in 2026-11.

### Short months
- **Given** closing day 31 **Then** the 2026-02 statement closes on 2026-02-28.

### Due date
- **Given** closing 25 and due 5 **Then** the 2026-10 statement is due on 2026-11-05.
- **Given** closing 5 and due 12 **Then** the 2026-10 statement is due on 2026-10-12.

### Rule changes do not touch the past
- **Given** closing day 25 until 2026-10 and day 10 from 2026-11 **Then** a purchase on 2026-10-20 stays in the 2026-10 statement
  and a purchase on 2026-10-28 goes to 2026-11.
- **When** a rule starts before the open statement **Then** it is rejected.

### Payment
- **Given** a statement of R$ 1.000,00 **When** paid R$ 1.000,00 from Checking with R$ 20,00 interest
  **Then** the statement is `paid`, Checking drops R$ 1.020,00, and the interest appears as its own expense.

### Limit
- **Given** a limit of R$ 5.000,00, purchases of R$ 1.200,00 and payments of R$ 200,00 **Then** used is R$ 1.000,00 and available is R$ 4.000,00.

## Out of scope
Installments (next phase), refunds, rotating credit calculation, card-to-card transfers.
