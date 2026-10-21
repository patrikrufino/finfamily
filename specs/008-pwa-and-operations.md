# PWA, running at home and backups

## Context
The app runs on a computer at home and is used from two phones on the local network. It must install like an app, behave well when the server is
unreachable, be easy to keep running, and never lose the SQLite data.

## Backups
- A backup is a consistent copy of the database made with SQLite's online backup (safe while the app is in use), named `finfamily-YYYYMMDD-HHmmss.db`.
- Every backup is verified (`PRAGMA integrity_check` is `ok`) before it is kept; a failed one is deleted and reported.
- Only the newest `BACKUP_KEEP` backups (default 14) are kept.
- The server makes a backup on start and then every `BACKUP_INTERVAL_HOURS` (default 24, `0` turns the schedule off). A backup is also skipped
  on start when the latest one is younger than the interval.
- The Settings screen lists the backups (name, size, date) and can make one on demand.
- `pnpm backup` makes a backup from the command line. `pnpm restore <file>` restores one: it first saves the current database as
  `<db>.before-restore-<timestamp>` and refuses a file that fails the integrity check. The server must be stopped while restoring.

## Running at home
- One process serves the API and the built web app on the same port (`pnpm build && pnpm start`), so the phone only needs one address.
- HTTPS is optional via `TLS_CERT` and `TLS_KEY` (PWA installation and service workers on a phone need a secure context).
- Unknown non-API paths return the app (SPA fallback); unknown `/api` paths return 404 JSON.

## PWA
- Manifest: name, short name, description, `pt-BR`, standalone, portrait, theme and background colors, PNG icons 192/512 plus a maskable 512,
  and shortcuts: new transaction, budget, cards.
- The shortcut "new transaction" opens the app with the transaction form open (`/?new=1`), and the parameter is removed afterwards.
- Apple touch icon and mobile web app meta tags; light and dark `theme-color`.
- The app shell is cached by a service worker and updates itself. API calls are never cached.
- When the server cannot be reached the shell still opens and a banner explains it ("Sem conexão com o servidor") with a retry action; it disappears by itself
  when the connection is back.
- When the browser offers installation, Settings shows an "Install app" button; on iOS it shows the Share > Add to Home Screen steps.

## Settings and polish
- Settings screen (gear in the header): language (pt-BR, en; remembered on the device and applied to `<html lang>`), install, backups and app version.
- Unknown screens show a "not found" page with a way back; an unexpected error shows a friendly message with a reload action instead of a blank page.
- Keyboard focus is clearly visible.

## Acceptance criteria
### Backup retention
- **Given** `BACKUP_KEEP=3` and 5 backups **Then** only the 3 newest remain.

### Verified backup
- **When** a backup is made **Then** it opens and passes the integrity check, and contains the same data.

### Restore
- **When** a backup is restored **Then** the previous database is kept as `.before-restore-*` and the data of the backup is back.

### Offline shell
- **Given** the app was opened once **When** the server is unreachable **Then** reloading shows the navigation and the offline banner.

### Language
- **When** the user picks English **Then** the texts change, the choice survives a reload and `<html lang>` is `en`.

## Out of scope
Push notifications, offline writes, cloud sync, user accounts.
