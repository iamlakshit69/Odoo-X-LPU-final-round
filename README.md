# Champions Club: Sports Club Management System

One platform for court booking, memberships, shop, bar POS, public site/CRM, finance/HR and admin.

## Layout

| Path | Purpose |
|---|---|
| `backend/src/modules/<module>` | One folder per business module (routes, services, repositories, models) |
| `backend/src/shared` | Cross-cutting services: auth-rbac, pricing, notifications, realtime, audit, settings, storage, db |
| `backend/tests` | unit, integration, concurrency (double-booking test lives here) |
| `db/migrations`, `db/seeds` | SQL migrations and seed data (single shared schema) |
| `frontend/src/modules/<module>` | UI per module (pages, components, api) |
| `frontend/src/public-site` | Public website (plans, availability, shop, enquiry form) |
| `frontend/src/shared` | Layouts, providers, shared components |
| `docs` | Brief, research, architecture notes, API contracts |

## Modules

membership, booking, shop, pos, crm, finance, admin (see each module's README).

## Rules of the repo

1. Each dev works inside their own module folders; changes to `shared/` or `db/migrations` need a quick heads-up to the other dev.
2. Migrations are numbered and never edited after merge.
3. Business rules (plans, discounts, cancellation, tax, thresholds) live in the settings table, not in code.
4. Hard invariants are enforced by the database (no overlapping bookings, no negative stock, no overpayment).
5. Ledgers (stock movements, payments, tab entries, audit log) are append-only.

## Getting started

```
cp .env.example .env
docker compose up -d db
```
