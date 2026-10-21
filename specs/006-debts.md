# Debts (dívidas)

## Context
Debts the household **owes** to someone (a loan, a bill in arrears, an agreement). The balance can grow with interest and shrink with payments or a negotiated discount.
Debts the household is owed are out of scope.

## Rules
- A debt has a creditor (name), an original amount, the date it was opened, an optional category for its payments, and the person who registered it.
- **Balance = original + interest - discounts - payments.** The debt is `settled` when the balance reaches zero.
- **Interest** can be posted at any time (amount > 0, dated). It increases the balance and moves no money.
- **Discount** (negotiated abatement) reduces the balance without moving money; it cannot exceed the current balance.
- **Payment (baixa)** is partial or total, from an account, dated today or earlier, and cannot exceed the current balance.
  A payment is recorded as an **expense** on that account (so it lowers the balance of the account and counts in the budget by its category),
  linked to the debt. Opening a debt does not create an expense.
- Editing or deleting a payment transaction changes the balance accordingly; its kind and account kind cannot be turned into something else.
- Interest and discount entries can be removed as long as the balance does not become negative.
- A debt without payments can be deleted (with its entries). A debt with payments is kept as history.
- The statement of a debt lists the opening, interest, discounts and payments in date order with the running balance.

## Acceptance criteria
### Balance
- **Given** a debt of R$ 1.000,00 with R$ 80,00 of interest and R$ 300,00 paid **Then** the balance is R$ 780,00.

### Partial and total payment
- **Given** a balance of R$ 780,00 **When** R$ 300,00 is paid from Checking **Then** the balance is R$ 480,00 and Checking drops R$ 300,00, as an expense.
- **When** the remaining R$ 480,00 is paid **Then** the debt is `settled`.

### Limits
- **When** a payment is above the balance **Then** it is rejected.
- **When** a payment is dated in the future **Then** it is rejected.
- **When** a discount is above the balance **Then** it is rejected.

### Removing entries
- **Given** R$ 80,00 of interest and R$ 1.050,00 paid on a R$ 1.000,00 debt **When** the interest is removed **Then** it is rejected (the balance would be negative).

### Budget
- **Given** a payment with a category **Then** it counts as spent in that category in the month of the payment.

## Out of scope
Receivables (money owed to the household), automatic interest calculation, payment on a credit card.
