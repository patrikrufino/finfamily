# FinFamily

Family finance PWA (React 19, Ark UI, Panda CSS, Hono, SQLite). Local use, no login.

## Run
```bash
pnpm install
pnpm dev            # API on :3333, web on :5173 (reachable from your phone on the LAN)
pnpm test           # unit + integration
pnpm --filter @finfamily/web test:e2e
```
The database file is `finfamily.db` (override with `DATABASE_PATH`). Backup: `pnpm backup` (writes to `./backups`, override with `BACKUP_DIR`).

See `CLAUDE.md` for conventions and `specs/` for the specifications.
