# Champions Club

Sports club management system (hackathon build). Source of truth: `docs/CHAMPIONS_CLUB_ARCHITECTURE.md`.

## Ownership

| Area | Owner |
|---|---|
| `apps/api/src/core`, modules: members, courts, bookings, social, pricing, crm | Dev A |
| modules: shop, inventory, bar, invoices, payments, tax, finance, expenses, hr | Dev B |
| `apps/web` | Dev C |
| `packages/contract/src/<module>.ts` | owner of that module |
| db schema, sql, seed files | per file header |

## Run (filled in during phase 0)

```
cp .env.example .env
docker compose up -d db
pnpm install
pnpm db:reset
pnpm dev
```
