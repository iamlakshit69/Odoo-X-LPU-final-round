# API Route Mapping & Conventions

This file documents the routes exposed by the Fastify backend and how `@club/web` interacts with them.
Per architecture guidelines, the running backend in `apps/api/src/app.ts` is the source of truth.

## Route Prefix
All API module routes are mounted with prefix `/api` in `apps/api/src/app.ts`:

- **Auth**:
  - `POST /api/auth/login` (body: `{ email, password }`, sets signed HTTP-only cookie)
  - `POST /api/auth/logout` (clears cookie)
  - `GET /api/me` (requires session cookie, returns `{ user, role, permissions, memberId, activePlan }`)

- **Courts & Availability**:
  - `GET /api/public/availability?date=YYYY-MM-DD[&courtType=...]`
  - `GET /api/availability?date=YYYY-MM-DD[&courtType=...]` (staff view, includes member & booking info)
  - `GET /api/admin/court-types`
  - `PUT /api/admin/court-types/:id`
  - `GET /api/admin/courts`
  - `POST /api/admin/courts`

- **Bookings & Social**:
  - `GET /api/bookings?date=YYYY-MM-DD&...`
  - `POST /api/bookings` (body: `{ courtId, startAt, memberId?, guest?, channel }`)
  - `POST /api/bookings/:id/cancel` (body: `{ reason?, overrideRefundPct? }`)
  - `GET /api/social/sessions?date=YYYY-MM-DD`
  - `POST /api/social/sessions/:id/signup` (body: `{ memberId }`)
  - `POST /api/social/sessions/:id/cancel-signup`

- **Pricing**:
  - `POST /api/pricing/quote` (body: `{ kind, scopeRef, basePricePaise, qty, memberId?, channel, at }`)
  - `GET /api/admin/price-rules`

- **Members**:
  - `GET /api/plans` (public plans)
  - `GET /api/members?q=...&status=...`
  - `POST /api/members` (creates member + initial membership + invoice)
  - `GET /api/members/:id`
  - `GET /api/members/:id/timeline`
  - `POST /api/members/:id/renew`
  - `POST /api/members/:id/change-plan`
  - `POST /api/members/:id/suspend`
  - `POST /api/members/:id/reinstate`
  - `POST /api/checkins`
  - `GET /api/checkins/current`

- **Finance & Invoices**:
  - `GET /api/invoices`
  - `GET /api/invoices/:id`
  - `POST /api/invoices/:id/payments` (record cash / card / upi payment)
  - `POST /api/invoices`

- **Realtime SSE**:
  - `GET /api/events` (authenticated stream for `booking.changed`, `order.item`, `order.status`, `stock.low`, `lead.created`, `dashboard.tick`)
  - `GET /api/public/events` (public stream restricted to `booking.changed`)
