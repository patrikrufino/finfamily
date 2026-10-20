# Foundation

## Context
Base of the app: money handling, API skeleton, mobile shell, i18n, theme, who-is-using.

## Rules
- Money is stored and computed as integer cents; decimals never use floats.
- Splitting an amount puts the remainder cents on the last part.
- The household has two members seeded at database creation: Patrik and Heloisa.
- UI text comes from locale files; default locale is pt-BR.
- The theme follows the system unless the user picks one; the choice is stored on the device.
- The selected person is stored on the device and defaults to Patrik.

## Acceptance criteria
### Money split
- **Given** R$ 100,00 **When** split in 3 **Then** parts are 33,33 / 33,33 / 33,34.

### Locale formatting
- **Given** 123456 cents **When** formatted in pt-BR **Then** the result is `R$ 1.234,56`.

### Seeded people
- **Given** a new database **When** `GET /api/people` **Then** Patrik and Heloisa are returned, once, even after reopening the file.

### Mobile shell
- **Given** the app opens on a phone **Then** a bottom navigation shows Início, Lançamentos, Orçamento, Cartões, Dívidas and a quick "Novo lançamento" button.

### Dark theme
- **When** the user turns on the dark theme **Then** `data-theme="dark"` is applied and remembered.

## Out of scope
Any financial feature (see next specs).
