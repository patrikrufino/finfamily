# Installments (parcelamentos)

## Context
A purchase can be split in equal monthly installments, paid from an account or charged to a credit card. Installments can be edited one by one,
anticipated (paid ahead of time, possibly with a discount) or the whole remaining balance can be settled at once.

## Rules
- A plan has a description, total, number of installments (2 to 120), date of the first installment, a source (an account **or** a card),
  an optional category and the person who made it.
- Installments are equal; the remainder cents go to the last one. Installment `i` is dated `first date + (i - 1)` months, keeping the day of the
  month (clamped to the month's last day: 31 Jan, 28 Feb, 31 Mar).
- Each installment is an `expense` transaction linked to the plan with its number.
  - On an **account**: an expense on that account, `settled` when its date has arrived, `scheduled` before that.
  - On a **card**: a card purchase on the installment's date, so it falls in the statement of that date by the card's closing rules.
- Scheduled installments become `settled` automatically once their date arrives.
- Each installment can be edited on its own (amount, date, category). The plan's remaining total follows the installments.
- **Anticipate**: the user picks future (scheduled) installments and informs the amount actually paid (equal to or lower than their sum, for a discount)
  and the date. The picked installments are removed from the schedule and replaced by one **anticipation** item of that amount, dated on the payment date,
  on the same account or card. Anticipating everything that remains is "settling" (quitar).
- Only installments that are scheduled and dated after today can be anticipated.
- Installments count in the budget like any expense: settled ones as spent, scheduled ones as committed.
- Canceling a plan removes its scheduled installments; settled ones stay as history.

## Acceptance criteria
### Equal split
- **Given** R$ 100,00 in 3 installments **Then** they are 33,33 / 33,33 / 33,34.

### Dates
- **Given** a first installment on 2026-01-31 **Then** the next ones are on 2026-02-28, 2026-03-31 and 2026-04-30.

### Card installments
- **Given** a card closing on day 25 and a 3x purchase on 2026-10-20 **Then** the installments fall in the statements of 2026-10, 2026-11 and 2026-12.

### Account installments
- **Given** a 3x plan on an account whose first date is today **Then** the first is settled and the other two are scheduled and do not change the balance.

### Anticipation
- **Given** installments 3, 4 and 5 of R$ 100,00 each **When** anticipated paying R$ 270,00 **Then** they are removed, an anticipation of R$ 270,00 is recorded
  on the payment date, and the saving is R$ 30,00.
- **When** the amount is above the sum of the picked installments **Then** it is rejected.
- **When** an installment is already settled **Then** it cannot be anticipated.

### Editing one installment
- **Given** a plan of 3 x R$ 100,00 **When** installment 2 is changed to R$ 120,00 **Then** the others keep their amounts and the remaining total is R$ 220,00 + the unchanged ones.

## Out of scope
Installment interest calculation, refinancing.
