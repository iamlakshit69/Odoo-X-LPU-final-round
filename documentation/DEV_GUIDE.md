# Champions Club: Dev Guide (raw v0.1)

Suggested stack (change if your team already decided otherwise): **PostgreSQL 15 + Node/Express (or NestJS) + React + Socket.IO**.

---

## 1. Database & environment setup

### docker-compose.yml (repo root)
```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: champions
      POSTGRES_PASSWORD: champions
      POSTGRES_DB: champions_club
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/schema/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql
volumes:
  pgdata:
```

### .env.example (commit this; never commit `.env`)
```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://champions:champions@localhost:5432/champions_club
JWT_SECRET=change-me
JWT_EXPIRES_IN=1d
CLIENT_ORIGIN=http://localhost:5173
# Optional / later
SMTP_URL=
SMS_API_KEY=
PAYMENT_GATEWAY_KEY=
```

### Run it
```bash
cp .env.example .env
docker compose up -d            # starts Postgres and loads schema.sql on first run
docker compose down -v          # full DB reset (re-runs schema + seed)
```
After the first run, changes go in `database/migrations/` as numbered files (`002_add_x.sql`). Don't edit `schema.sql` silently once teammates have data.

---

## 2. Schema rules (everyone follows)

1. **Money** is `numeric(12,2)`. Never floats.
2. **Never hardcode** discounts, session length, daily limits, tax. Read from `membership_plans` / `settings`.
3. **Bookings**: conflict prevention is enforced by the DB (`EXCLUDE USING gist`). Backend should catch the error (`23P01`) and return `409`.
4. **Stock** only changes by inserting a row into `stock_movements` and updating `inventory` **in the same transaction**.
5. **Prices are snapshotted** into order item rows (`unit_price`), so future price changes don't rewrite history.
6. **Charged ≠ paid ≠ outstanding.** Payments go in `payments`; invoice/booking/order keep a `payment_status`.
7. **Soft deactivate** (`is_active`, `status`) instead of `DELETE`.
8. Sensitive changes (plan edits, refunds, cancellations, stock adjustments) write to `audit_logs`.

---

## 3. API contract conventions

- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <JWT>`; the JWT payload holds `userId`, `role`.
- JSON `camelCase` in API, `snake_case` in DB (map in the data layer).
- Timestamps in ISO-8601 UTC. Money as **strings** (`"450.00"`) or integers in paise, **pick one and stick to it**.
- Pagination: `?page=1&limit=20` → `{ data: [], page, limit, total }`
- Success: `{ data: ... }`. Error: `{ error: { code: "BOOKING_CONFLICT", message: "..." } }`
- Status codes: 200/201 ok, 400 validation, 401 unauthenticated, 403 forbidden, 404, 409 conflict, 422 business-rule violation.

### Endpoint map (v0.1, to agree on with Avinaash)

| Module | Endpoint | Notes |
|---|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `POST /auth/reset-password` | |
| Users | `GET/POST /users`, `PATCH /users/:id` | owner/manager |
| Members | `POST /members`, `GET /members?search=`, `GET /members/:id`, `PATCH /members/:id`, `GET /members/:id/history` | history = bookings, orders, payments |
| Plans | `GET /plans`, `PATCH /plans/:id` | config-driven |
| Memberships | `POST /members/:id/memberships`, `POST /memberships/:id/renew`, `POST /memberships/:id/upgrade`, `POST /memberships/:id/suspend` | |
| Courts | `GET/POST /courts`, `PATCH /courts/:id`, `POST /courts/:id/blocks` | |
| Availability | `GET /courts/availability?date=&sport=&courtId=` | **same endpoint for public site + front desk** |
| Bookings | `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `PATCH /bookings/:id`, `POST /bookings/:id/cancel` | |
| Pricing | `POST /pricing/quote` | shared engine |
| Social play | `POST /social-events`, `POST /social-events/:id/participants`, `GET /social-events/:id` | |
| Payments | `POST /payments`, `GET /payments?refType=&refId=`, `POST /payments/:id/refund` | shared |
| Products | `GET/POST /products`, `PATCH /products/:id` | |
| Inventory | `GET /inventory`, `POST /inventory/adjust`, `GET /inventory/:productId/movements`, `GET /inventory/low-stock` | |
| Purchases | `POST /purchase-orders`, `POST /purchase-orders/:id/receive` | |
| Shop orders | `POST /shop/orders`, `GET /shop/orders`, `PATCH /shop/orders/:id/status`, `POST /shop/orders/:id/cancel` | |
| Menu | `GET/POST /menu-items`, `PATCH /menu-items/:id` | |
| Tables | `GET /tables`, `PATCH /tables/:id` | |
| POS orders | `POST /pos/orders`, `POST /pos/orders/:id/items`, `PATCH /pos/orders/:id/status` | |
| Kitchen | `GET /kitchen/orders?status=` | + socket events |
| Tabs | `POST /tabs`, `GET /tabs/:id`, `POST /tabs/:id/payments`, `POST /tabs/:id/close` | |
| Shifts | `POST /shifts/start`, `POST /shifts/:id/end`, `GET /shifts/:id/report` | |
| Leads | `POST /leads` (public), `GET /leads`, `PATCH /leads/:id`, `POST /leads/:id/activities`, `POST /leads/:id/convert` | |
| Trials | `POST /trials` (public) | creates lead + booking |
| Finance | `GET /finance/dashboard?range=`, `GET/POST /invoices`, `POST /invoices/:id/payments`, `GET/POST /expenses` | |
| HR | `GET/POST /employees`, `POST /leave-requests`, `PATCH /leave-requests/:id`, `POST /payroll/run` | |
| Reports | `GET /reports/:type?from=&to=&format=csv\|pdf` | |
| Audit | `GET /audit-logs` | owner only |

### Example contract: create booking
```
POST /api/v1/bookings
{ "courtId": 1, "memberId": 42, "startTime": "2026-11-27T18:30:00Z", "durationMinutes": 60, "bookingType": "regular" }

201 → { "data": { "id": 981, "totalAmount": "450.00", "status": "confirmed", "paymentStatus": "unpaid" } }
409 → { "error": { "code": "BOOKING_CONFLICT", "message": "Court already booked for this time" } }
422 → { "error": { "code": "DAILY_LIMIT_REACHED", "message": "Max 2 sessions per day" } }
```
Booking rules: 60 min sessions, start times on 30 min intervals, max 2 sessions/member/day (read from the plan/settings).

### Socket.IO events
`availability:updated`, `kitchen:order:new`, `kitchen:order:status`, `table:status`, `lead:new`, `stock:low`

---

## 4. Git workflow

```
main        → always demoable (protected, merge via PR only)
develop     → integration branch
feature/<module>-<thing>   e.g. feature/bookings-conflict-check
fix/<thing>
```
- Branch from `develop`, PR into `develop`, 1 review required, `develop` → `main` at each milestone.
- Commit style: `feat(bookings): add conflict check`, `fix(pos): table release bug`, `chore(db): migration 003`.
- Rebase on `develop` before opening a PR. Keep PRs small (<400 lines where possible).
- **Schema changes**: separate PR, migration file, announce in group chat before merging.
- Never commit `.env`, `node_modules`, or uploads.

### Suggested repo layout
```
champions-club/
├── frontend/{admin-dashboard,member-portal,public-website,pos-interface}
├── backend/{auth,membership,bookings,inventory,shop-orders,cafeteria,crm,finance,hr,reports}
├── shared/{pricing-engine,payment-service,notification-service,permissions,validation}
├── database/{schema,migrations,seed-data}
└── documentation/{requirements,api,architecture}
```

---

## 5. Integration guidelines for teammates

1. **Own your module, share the core.** Don't write your own discount, payment or notification logic. Call `shared/pricing-engine`, `shared/payment-service`, `shared/notification-service`.
2. **Talk through services, not other people's tables.** E.g. shop asks `membershipService.getActivePlan(memberId)` rather than querying `memberships` directly.
3. **Single source of truth.** Public website availability = same API as front desk. No duplicated calendars.
4. **Every sale produces a `payments` row** and updates the parent's `payment_status`. Finance reads from there.
5. **Use transactions** for multi-step writes (order + stock + payment).
6. **Validate in the backend**; the frontend checks are only for UX.
7. **Check permissions via middleware** (`requireRole('front_desk','manager')`), not scattered `if`s.
8. **Contract changes**: update `documentation/api/` first, tell consumers, then merge.
9. Mock data: use `database/seed-data/` so everyone demos with the same members, courts and products.

### Integration order (recommended build sequence)
1. DB + auth + roles → 2. members/plans → 3. pricing engine + payments → 4. courts/bookings → 5. shop/inventory and POS in parallel → 6. CRM/website → 7. finance/HR/reports.

### Decisions to lock with Avinaash before coding
- [ ] Money format in API (string vs paise integer)
- [ ] ORM vs raw SQL (Prisma / Drizzle / knex / pg)
- [ ] Who owns which module (one owner each)
- [ ] Tax handling (GST yes/no, inclusive or exclusive)
- [ ] Trial sessions: free or paid
- [ ] Walk-ins: do they need a customer record, or just name + phone?
