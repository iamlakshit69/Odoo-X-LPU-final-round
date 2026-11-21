# Champions Club: Architecture and Build Plan (24-hour hackathon)

Audience: three teammates and their coding agents. Treat this file as the single source of truth.
Language: everything an agent needs is here. If something is missing, make the simplest choice that satisfies the rules in section 4, write it into `DECISIONS.md`, and move on. Do not stop to ask.

Legend: **P0** = demo cannot work without it. **P1** = build if P0 is green. **P2** = stub or skip.

---

## 0. How agents must use this file

1. Read sections 1 to 6 fully. Then read only your own module section plus section 11 (team split) and section 13 (agent prompts).
2. Work only inside the directories you own (section 11.2). Cross-module needs go through the service interfaces in section 6. Never import another module's internals.
3. Contract first: the zod schemas in `packages/contract` are frozen at hour 2. Change them only by PR with all three owners told.
4. Every rule in section 4 is a hard rule. If a task seems to conflict with one, the rule wins.
5. Done means: the endpoint works, has a test for its main invariant, appears in the seed data, and the frontend can call it.

---

## 1. Assumptions (edit here if the team differs, then tell the agents)

| Topic | Decision | Why |
|---|---|---|
| Team | 3 people: **Dev A** (core + booking backend), **Dev B** (commerce + money backend), **Dev C** (frontend only) | given |
| Language | TypeScript everywhere | one language, shared types |
| Database | PostgreSQL 15+ with `btree_gist` | exclusion constraint prevents double booking |
| Backend | Node 20, Fastify, zod (via fastify-type-provider-zod), Drizzle ORM | fast, typed, small |
| Frontend | Vite + React + TypeScript, TanStack Router + Query, shadcn/ui, Tailwind | shadcn-admin shell is the fastest good-looking admin |
| Realtime | Server-Sent Events from the API | simpler than WebSockets, enough for grids and kitchen screens |
| Jobs | `node-cron` in the API process, every job idempotent | no Redis needed |
| Auth | email + password, argon2, HTTP-only session cookie | keep it boring |
| Currency / tax | INR, GST (CGST+SGST only, intra-state), rates in a table | brief mentions UPI and taxes |
| Money | **integer paise** everywhere, never floats | rounding safety |
| Time | `timestamptz` in DB, club timezone `Asia/Kolkata` in settings; "day" means club-local day | daily limit must use local day |
| Hosting for demo | docker-compose (postgres + api) + `pnpm dev` for web | runs on a laptop |

Brief mismatch to design around: the intro says "tennis, padel and badminton", the club description says "tennis and cricket courts". Sport and court type are **data** (`court_types` table), never an enum in code.

---

## 2. Scope: the seven scenes and their features

Each scene in the problem statement is one vertical slice. A slice is done when someone can click through it start to finish.

### Scene 1: A new member walks in (membership) [Dev A]
- P0 Create member at front desk (name, phone, email, DOB, photo optional), choose plan Gold / Silver / Junior.
- P0 Plans are data: price, duration, daily booking limit, advance-booking days. Entitlements (court rate, shop discount, bar discount) come from `price_rules` and are shown on the plan card.
- P0 Membership rows are dated; states `active, expired, suspended, cancelled`. A nightly job flips `active -> expired`.
- P0 Expiry reminders at 30 and 7 days (notification service, in-app inbox plus console email stub).
- P0 Front-desk lookup: search by name, phone or member code; scan or type the QR code. Profile shows plan, status, expiry, and a timeline of bookings, orders, tabs, payments, check-ins.
- P0 Status gate: expired or suspended members cannot book and get no discounts.
- P1 One-click renew and plan switch (new dated row, price difference line on the invoice).
- P1 Check-in log and "currently in club" list.
- P1 Junior to guardian link (`member_guardians`); invoice goes to guardian.
- P0 Invoice auto-created on join and renew (calls `InvoiceService`).

### Scene 2: Booking a court on a busy evening (courts) [Dev A]
- P0 One availability grid (courts x half-hour slots) used by staff console, member portal and public site.
- P0 Sessions are 60 minutes, a new slot starts every 30 minutes, ranges are half-open `[start, end)`.
- P0 **No double booking, enforced by Postgres** (exclusion constraint), with a concurrency test.
- P0 Max 2 sessions per member per club-local day (limit comes from the plan), checked inside the booking transaction with the member row locked.
- P0 Price from the pricing engine (tier x channel x time band), snapshotted on the booking. Walk-ins pay walk-in rate, Gold may be free.
- P0 Staff can book for a member, a walk-in (name + phone) or take a phone enquiry (read-only availability).
- P0 Cancel with policy (hours before start -> refund %), policy stored as data. Refund is a negative payment row.
- P0 Plan change or suspension re-evaluates future bookings only when the owner asks (do not auto-cancel).
- P0 **Friday social play**: a social session blocks the whole court for its window, has capacity and a per-head price; members sign up; waitlist; promotion on cancellation.
- P1 Held status (5 min) while an online mock payment completes. Auto-assign court when the user picks a time but no court.
- P1 Recurring bookings (each occurrence is its own row, each checked by the constraint).
- P1 Blackout / maintenance blocks (a booking row of kind `block`).
- P2 Waitlist for regular slots, ICS export.

### Scene 3: Gearing up before a match (shop) [Dev B]
- P0 Catalogue: rackets, balls, shoes, accessories, apparel. Products have variants (size/colour), one SKU each.
- P0 One stock pool for counter and online channels. Stock is an append-only ledger; `on_hand`, `reserved`, `saleable = on_hand - reserved` are derived.
- P0 Low-stock threshold per variant; crossing it raises a notification and shows on the owner dashboard.
- P0 Counter sale (staff) and member online order from the portal, both through the same order service and pricing engine (member discount applied automatically).
- P0 Fulfilment: `pickup` (placed -> ready -> collected) or `delivery` (placed -> out_for_delivery -> delivered); address captured for delivery.
- P1 Reservations that expire (hold stock while an online order awaits payment).
- P1 Purchase order and receiving (writes ledger rows). P2 Returns.

### Scene 4: After the match, at the bar (POS) [Dev B]
- P0 Menu (food and drinks) with station `kitchen` or `bar`.
- P0 Tables and open tabs. A tab belongs to a table, a member, or both. Items are added by staff on a tablet-friendly screen.
- P0 Per-item status `pending -> preparing -> ready -> served`, and `void` with a reason. Kitchen and bar screens show only their own station, newest first, with a sound on new item.
- P0 Member discount applied automatically from the pricing engine; run a tab and settle before leaving; split bill and partial payments.
- P0 Tenders: cash, card, UPI (UPI is a tender type we add ourselves).
- P0 Till sessions (open with float, close with counted cash, shortage or excess recorded) and a daily report: sales by tender, by category, by waiter, voids, discounts, tax.
- P1 Merge or transfer a tab; table "occupied too long" flag; staff work-shift rota (see HR).

### Scene 5: A stranger finds the club online (public site and CRM) [Dev A API, Dev C UI]
- P0 Public pages: home, plans and prices, live availability this week, shop catalogue, contact, "Book a trial".
- P0 Every enquiry or trial request becomes a **lead** in stage `new` with source recorded, and staff get an in-app notification immediately.
- P0 Staff CRM: Kanban by stage (`new, contacted, quotation_sent, follow_up, converted, lost`), one lead page with a combined timeline (notes, tasks, messages), follow-up tasks with due dates.
- P0 Quote from line items; sending it moves the lead to `quotation_sent` (email is a stub that logs and shows in the lead timeline).
- P0 Convert lead to member in one step (creates member + membership + invoice).
- P1 Trial booking: pick a slot, creates lead + booking. P1 Lead assignment round-robin. P1 Reason required when marking Lost.

### Scene 6: The owner at the end of the month (finance and HR) [Dev B]
- P0 Every sale produces an **invoice** with lines tagged by revenue source (`membership, court, shop, bar, corporate`) and **payments** rows linked to it. **Charged, paid, outstanding** are always separate numbers.
- P0 GST on every line (rate from `tax_rates`), stored as CGST+SGST paise amounts.
- P0 Owner dashboard (today, this week, this month, custom range): charged, collected, outstanding, expenses, profit, GST collected, payroll due; split by source and by payment method; share as a link or PDF/CSV export.
- P0 Business clients (corporate accounts) with invoices and aging buckets.
- P0 Expenses with category and approval. 
- P0 Employees, leave types, leave balances, leave requests with approve/reject and a balance check.
- P0 Payroll: monthly run from salary components producing a payslip per employee (simple version).
- P1 GSTR-1-style summary and CSV export. P2 double-entry ledger (do not build).

### Scene 7: Admin and shared services (everyone) [Dev A]
- P0 Roles and permissions as database rows, deny by default, same check drives API and UI.
- P0 Audit log written server-side for every write.
- P0 Settings table editable in the UI (booking rules, cancellation policy, tax rates, stock thresholds, lead stages, social-play windows).
- P0 One notification service, one realtime channel.

---

## 3. Architecture

```
                 +--------------------------- apps/web (Dev C) ----------------------------+
                 | Public site | Member portal | Staff console (front desk, POS, KDS, CRM,   |
                 |             |               | finance, HR, settings)                      |
                 +------------------+------------------------+----------------------------+
                                    | REST (JSON, zod contract) + SSE /events
                 +------------------v------------------------v----------------------------+
                 |                           apps/api (Fastify)                             |
                 |  auth/session -> can() middleware -> route -> service -> db transaction  |
                 |                                                                          |
                 |  Dev A modules                       Dev B modules                       |
                 |  core: auth, rbac, audit, settings,  shop, inventory, bar, invoices,     |
                 |        notifications, events, jobs   payments, tax, finance, expenses,   |
                 |  members, courts, bookings, social,  hr (employees, leave, payroll)      |
                 |  pricing, crm (leads, quotes)                                            |
                 +------------------------------------+-------------------------------------+
                                                      |
                 +------------------------------------v-------------------------------------+
                 | PostgreSQL: tables, exclusion constraint, CHECKs, triggers, views         |
                 +--------------------------------------------------------------------------+
```

Request path for any write: `route (zod validates) -> can(user, permission) -> service (one DB transaction) -> audit.log -> events.publish -> response`.

### 3.1 Repository layout (pnpm monorepo)

```
/
  DECISIONS.md                 # append-only log of choices made by agents
  docker-compose.yml           # postgres
  package.json, pnpm-workspace.yaml
  packages/
    contract/                  # zod schemas, route table, error codes, fixtures. OWNED BY ALL, frozen at h2
      src/{common,auth,members,courts,bookings,pricing,shop,bar,finance,crm,hr,admin}.ts
      src/fixtures/*.ts        # example responses used by MSW mocks and tests
  apps/
    api/
      src/
        main.ts, app.ts
        core/                  # Dev A: auth, rbac, audit, settings, notifications, events, jobs, errors, db
        modules/
          members/ courts/ bookings/ social/ pricing/ crm/        # Dev A
          shop/ inventory/ bar/ invoices/ payments/ tax/ finance/ expenses/ hr/   # Dev B
        db/
          schema/              # one file per module, owner edits only their files
          sql/                 # extra SQL applied after push: 00_ext.sql, 10_constraints.sql, 20_views.sql, 30_triggers.sql
          seed/                # one file per module, run in order by seed/index.ts
      test/
    web/
      src/
        api/                   # typed client built on packages/contract, MSW handlers
        routes/{public,portal,admin}/
        components/ lib/ hooks/ auth/
```

### 3.2 Database workflow (no migration files during the hackathon)

- Tables are defined in `db/schema/*.ts`. Constraints, views and triggers live in `db/sql/*.sql`, written idempotently.
- `pnpm db:reset` = drop and recreate schema, `drizzle-kit push`, apply `db/sql/*.sql` in filename order, run `seed`. **Always use `db:reset`; never run `push` alone on a populated database** (I could not confirm how drizzle-kit treats constraints it does not know about, so do not rely on it).
- This avoids migration-file merge conflicts between teammates. Each person edits only their own schema files.

### 3.3 Conventions (all agents)

- IDs: `uuid` (`gen_random_uuid()`), plus human codes where needed (`member_code` like `CC-000123`, invoice number `INV-2026-000123`).
- Money: `integer` paise, column names end in `_paise`. Tax rates in basis points (`1800` = 18%).
- Time: `timestamptz` columns end in `_at`; dates end in `_on`. Convert to club-local day only in `lib/clubTime.ts`.
- Errors: HTTP status plus body `{ "error": { "code": "SLOT_TAKEN", "message": "...", "details": {} } }`. Codes: `VALIDATION 400`, `UNAUTHENTICATED 401`, `FORBIDDEN 403`, `NOT_FOUND 404`, `SLOT_TAKEN 409`, `OUT_OF_STOCK 409`, `INVALID_STATE 409`, `DAILY_LIMIT 422`, `MEMBERSHIP_INACTIVE 422`, `OVERPAYMENT 422`.
- Pagination: `?limit=50&cursor=...`. Lists return `{ items, nextCursor }`.
- Every module exports `register(app)` for its routes and a typed service object; nothing else is imported by other modules.
- Public (no login) routes are under `/public/*` and are rate-limited; they expose no personal data.

---

## 4. Hard rules (the seven cross-cutting patterns, made enforceable)

1. **The database is the referee for hard invariants.**
   - No overlapping active bookings per court: exclusion constraint (section 5.2).
   - No negative stock: `stock_levels` has `CHECK (on_hand >= 0 AND reserved >= 0)`.
   - No overpayment: `PaymentService` locks the invoice row; a trigger also rejects `sum(payments) > total` for non-refund rows.
2. **Append-only ledgers.** `stock_movements`, `payments`, `tab_events`, `audit_log` and `notifications` are never updated or deleted. Corrections are new rows (a refund is a negative payment; a stock fix is a movement).
3. **Business rules are data.** Plans, price rules, cancellation policy, tax rates, daily limits, hold minutes, stock thresholds, lead stages, social-play windows live in tables and are editable in the UI. No magic numbers in code. Seed supplies defaults.
4. **One pricing engine.** Courts, shop, bar, memberships and social play all call `PricingEngine.quote(...)`. The frontend never computes a price; it displays the returned breakdown.
5. **Charged, paid, outstanding are separate.** An invoice has lines (charged). Payments are separate rows (paid). Outstanding = charged minus paid, derived in a view. Every line carries a `source` tag.
6. **Deny by default.** Permissions are rows; `can(user, 'resource:action')` guards every route; `GET /me` returns the permission list and the frontend hides what the user cannot do (the API still enforces it).
7. **One notification service, one realtime channel.** Modules call `notifications.send(...)` and `events.publish(...)`; nobody sends email or opens a socket directly.

Also: **every write is audited** (actor, action, resource, record id, before, after, request id) by the `withAudit` wrapper in `core`, never from the client.

---

## 5. Data model

Columns shown are the important ones; add `id uuid pk`, `created_at`, `updated_at` to every table unless it is a ledger (ledgers have only `created_at`). "FK" = foreign key.

### 5.1 Core (Dev A)

```
users(id, email unique, password_hash, name, role_id FK, member_id FK null, employee_id FK null, active)
roles(id, code unique, name)                       -- owner, manager, front_desk, shop_clerk, bartender, kitchen, cashier, finance, hr, member
permissions(id, code unique)                       -- 'booking:create', 'booking:read:own', 'invoice:read', ...
role_permissions(role_id FK, permission_id FK, pk(role_id, permission_id))
settings(key pk, value jsonb, description, updated_by)   -- see 5.9 for the keys
audit_log(id, at, actor_user_id, action, resource, record_id, before jsonb, after jsonb, meta jsonb, request_id)   -- ledger
notifications(id, user_id FK null, member_id FK null, lead_id FK null, channel('inapp','email','sms','whatsapp'),
              template, payload jsonb, status('queued','sent','read','failed'), created_at, read_at)
```

### 5.2 Members and plans (Dev A)

```
plans(id, code unique ('gold','silver','junior'), name, price_paise, duration_days,
      daily_booking_limit int default 2, advance_booking_days int, active)
members(id, member_code unique, full_name, phone unique, email, dob, photo_url, qr_token unique, notes, created_by)
memberships(id, member_id FK, plan_id FK, starts_on, ends_on,
            status('active','expired','suspended','cancelled'), invoice_id FK null, replaced_by FK null)
member_guardians(member_id FK, guardian_member_id FK, relationship)
checkins(id, member_id FK, at, method('qr','manual'), staff_user_id FK)        -- ledger
```
Current membership = the `active` row where `today BETWEEN starts_on AND ends_on`. Plan changes close the current row and insert a new one (history stays).

### 5.3 Courts and bookings (Dev A)

```
court_types(id, code ('tennis','padel','badminton','cricket'), name, base_price_per_hour_paise, tax_category)
courts(id, court_type_id FK, name, active, sort_order)
bookings(id, court_id FK, kind('regular','social','block'), status('held','confirmed','completed','cancelled','expired','no_show'),
         member_id FK null, guest_name, guest_phone, start_at, end_at,
         during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,
         expires_at null,                       -- only for status 'held'
         channel('counter','phone','online','public'),
         price_paise, price_breakdown jsonb,    -- snapshot from PricingEngine
         invoice_id FK null, created_by FK, cancelled_at, cancel_reason, refund_paise,
         social_session_id FK null)
social_sessions(id, court_id FK, start_at, end_at, capacity, price_per_head_paise, title, status('open','closed','cancelled'), booking_id FK)
social_signups(id, session_id FK, member_id FK, status('confirmed','waitlisted','cancelled'), position, invoice_id FK null)
```

**Required SQL in `db/sql/10_constraints.sql`:**
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (court_id WITH =, during WITH &&)
  WHERE (status IN ('held','confirmed','completed','no_show'));
ALTER TABLE bookings ADD CONSTRAINT bookings_end_after_start CHECK (end_at > start_at);
ALTER TABLE bookings ADD CONSTRAINT bookings_regular_is_60min
  CHECK (kind <> 'regular' OR end_at - start_at = interval '60 minutes');
CREATE INDEX bookings_member_day ON bookings (member_id, start_at);
```
Catch Postgres error `23P01` in the service and return `SLOT_TAKEN`. Slot alignment (minutes 0 or 30 in club time) is validated in the service using `settings.booking.slot_minutes`.

### 5.4 Pricing and tax (Dev A owns pricing, Dev B owns tax_rates)

```
price_rules(id, name, applies_to('court','shop','bar','membership','social'),
            scope_ref text null,                 -- court_type code, product category, menu category; null = all of that kind
            tier('gold','silver','junior','walkin') null,       -- null = any
            channel('counter','phone','online','public') null,
            day_mask int null,                   -- bit per weekday, null = all
            time_from time null, time_to time null,             -- club-local band, null = all day
            effect('fixed_price','percent_off','amount_off'), value int,   -- paise or basis points
            priority int, valid_from date null, valid_to date null, active)
tax_rates(id, category unique, rate_bps int, description)      -- seed with placeholders, owner confirms with their CA
```

### 5.5 Shop and inventory (Dev B)

```
products(id, name, category('racket','ball','shoe','accessory','apparel'), description, image_url, base_price_paise, tax_category, active)
product_variants(id, product_id FK, sku unique, option_label ('UK 9 / White'), price_paise null, low_stock_threshold int, active)
stock_movements(id, variant_id FK, delta int, reason('purchase','sale','return','adjustment','reservation_release'), ref_type, ref_id, note, by_user_id)   -- ledger
stock_levels(variant_id pk, on_hand int CHECK >= 0, reserved int CHECK >= 0)        -- maintained by trigger on stock_movements and reservations
stock_reservations(id, variant_id FK, qty, order_id FK, expires_at, status('active','released','converted'))
orders(id, member_id FK null, guest_name, guest_phone, channel('counter','online'), status('placed','ready','out_for_delivery','collected','delivered','cancelled'),
       fulfilment('counter','pickup','delivery'), delivery_address, invoice_id FK, created_by)
order_items(id, order_id FK, variant_id FK, qty, unit_price_paise, price_breakdown jsonb)
```
`saleable = on_hand - reserved` (a view `v_stock`). The low-stock alert fires when `saleable <= low_stock_threshold`.

### 5.6 Bar and cafeteria (Dev B)

```
menu_items(id, name, category('food','drink'), station('kitchen','bar'), price_paise, tax_category, active)
bar_tables(id, label, seats, x, y)                              -- floor plan
till_sessions(id, opened_by FK, opened_at, opening_float_paise, closed_at, counted_cash_paise, expected_cash_paise, variance_paise)
tabs(id, table_id FK null, member_id FK null, guest_label, status('open','settled','void'), opened_by FK, till_session_id FK, invoice_id FK null)
tab_items(id, tab_id FK, menu_item_id FK, qty, unit_price_paise, price_breakdown jsonb,
          status('pending','preparing','ready','served','void'), void_reason, added_by FK)
tab_events(id, tab_id FK, at, type, payload jsonb, by_user_id)  -- ledger: item added, status change, void, transfer, settle
```

### 5.7 Invoices and payments (Dev B)

```
business_clients(id, name, gstin null, contact_name, phone, email, credit_days)
invoices(id, number unique, member_id FK null, business_client_id FK null, guest_name,
         status('draft','issued','void'), issued_at, due_on,
         subtotal_paise, cgst_paise, sgst_paise, total_paise)
invoice_lines(id, invoice_id FK, source('membership','court','shop','bar','corporate','social'),
              description, qty, unit_price_paise, discount_paise, taxable_paise, tax_rate_bps, cgst_paise, sgst_paise, total_paise,
              ref_type, ref_id)
payments(id, invoice_id FK, method('cash','card','upi','online','comp','refund'), amount_paise,   -- refund rows are negative
         received_at, received_by FK, till_session_id FK null, reference text)                    -- ledger
-- view v_invoice_balance(invoice_id, charged_paise, paid_paise, outstanding_paise, status('unpaid','partial','paid','overpaid'))
expenses(id, category, description, amount_paise, incurred_on, paid, receipt_url, status('submitted','approved','rejected'), submitted_by, approved_by)
```

### 5.8 CRM (Dev A) and HR (Dev B)

```
leads(id, name, phone, email, source('web_form','trial_booking','walk_in','phone','referral'), interest, stage,   -- stage values from settings
      assigned_to FK null, lost_reason, converted_member_id FK null, trial_booking_id FK null)
lead_activities(id, lead_id FK, type('note','call','message','stage_change','quote','task_done'), body, by_user_id, at)
lead_tasks(id, lead_id FK, title, due_on, done_at, assigned_to FK)
quotes(id, lead_id FK, number, status('draft','sent','accepted','rejected'), valid_until, total_paise)
quote_lines(id, quote_id FK, description, qty, unit_price_paise)

employees(id, name, phone, email, role_title, joined_on, active, user_id FK null)
work_shifts(id, employee_id FK, starts_at, ends_at, area('front_desk','bar','shop','courts'))     -- staff rota
leave_types(id, code, name, annual_days)
leave_balances(employee_id FK, leave_type_id FK, year, allotted, used, pk(...))
leave_requests(id, employee_id FK, leave_type_id FK, from_on, to_on, days, reason, status('pending','approved','rejected'), decided_by, decided_at)
salary_components(id, employee_id FK, name, kind('earning','deduction'), amount_paise)
payslips(id, employee_id FK, month_on, gross_paise, deductions_paise, net_paise, status('draft','paid'), paid_at)
```

### 5.9 Settings keys (seed defaults)

```
club.timezone                 "Asia/Kolkata"
booking.slot_minutes          30
booking.session_minutes       60
booking.hold_minutes          5
booking.default_daily_limit   2
booking.advance_days          14
booking.cancellation_policy   [{"hours_before":24,"refund_pct":100},{"hours_before":2,"refund_pct":50},{"hours_before":0,"refund_pct":0}]
social.windows                [{"weekday":5,"from":"18:00","to":"22:00","capacity":16}]
membership.reminder_days      [30,7]
crm.stages                    ["new","contacted","quotation_sent","follow_up","converted","lost"]
inventory.default_low_stock   3
bar.table_occupied_minutes    90
```

---

## 6. Shared service interfaces (the only cross-module surface)

Dev A implements `PricingEngine`, `Notifications`, `Events`, `Audit`, `Can`, `Settings`. Dev B implements `InvoiceService`, `PaymentService`. Both sides code against these signatures from hour 2; Dev B ships a working `InvoiceService` and `PaymentService` by hour 5 (Dev A uses an in-memory stub until then).

```ts
// ---------- Dev A ----------
interface PricingEngine {
  quote(input: {
    kind: 'court' | 'shop' | 'bar' | 'membership' | 'social';
    scopeRef: string;                 // court_type code | product category | menu category | plan code
    basePricePaise: number;           // per unit (court: per session)
    qty: number;
    memberId?: string;                // undefined => walk-in
    channel: 'counter' | 'phone' | 'online' | 'public';
    at: Date;                         // service time (club-local band is derived)
  }): Promise<{
    unitPaise: number; totalPaise: number;
    tier: 'gold' | 'silver' | 'junior' | 'walkin';
    breakdown: Array<{ ruleId: string; label: string; deltaPaise: number }>;   // shown in the UI as-is
  }>;
}
// Resolution: 1) tier = member's current active plan, else 'walkin' (expired/suspended => 'walkin').
// 2) candidate rules = active, in validity window, matching kind/scope/tier/channel/day/time (null = wildcard).
// 3) winner = most specific (count of non-null match fields), tie-break higher priority. Apply its effect to base.
// 4) return breakdown. No rule matched => base price.

interface Notifications { send(n: { to: { userId?: string; memberId?: string; leadId?: string }; template: string; channel?: Channel[]; data: object }): Promise<void>; }
interface Events { publish(topic: Topic, payload: object): void; }          // topics listed in 7.1; SSE fans out
interface Audit { log(e: { actor: string; action: string; resource: string; recordId: string; before?: object; after?: object }): Promise<void>; }
interface Can { (user: SessionUser, permission: string, ctx?: { ownerMemberId?: string }): boolean; }
interface Settings { get<T>(key: string): Promise<T>; }

// ---------- Dev B ----------
interface InvoiceService {
  create(input: {
    customer: { memberId?: string; businessClientId?: string; guestName?: string };
    lines: Array<{ source: LineSource; description: string; qty: number; unitPricePaise: number; discountPaise?: number;
                   taxCategory: string; refType: string; refId: string }>;
    dueOn?: Date;
  }, tx: DbTx): Promise<{ invoiceId: string; number: string; totalPaise: number }>;       // joins caller's transaction
  addLines(invoiceId: string, lines: ..., tx: DbTx): Promise<void>;                        // e.g., bar tab settle
}
interface PaymentService {
  record(input: { invoiceId: string; method: 'cash'|'card'|'upi'|'online'|'comp'; amountPaise: number; reference?: string; tillSessionId?: string }, tx: DbTx): Promise<{ paymentId: string; outstandingPaise: number }>;
  refund(input: { invoiceId: string; amountPaise: number; reason: string }, tx: DbTx): Promise<{ paymentId: string }>;   // inserts a negative row
}
```
Rule: a zero-total invoice (for example a Gold court booking) is still created, so the owner can see what was given away. The line stores `unit_price_paise` = list price and `discount_paise` = list price, so `total_paise` = 0 and the invoice balance view shows it as `paid` with no payment row needed.

---

## 7. Module specifications

Path prefix `/api`. "perm" is the permission checked. All list endpoints paginate. All writes are audited and emit events where noted.

### 7.1 Core, auth, RBAC, settings, notifications (Dev A)

| Method + path | perm | Notes |
|---|---|---|
| POST `/auth/login`, POST `/auth/logout` | public | sets/clears session cookie |
| GET `/me` | any | `{ user, role, permissions[], memberId?, activePlan? }`; frontend builds menus from this |
| GET/PUT `/admin/roles`, `/admin/roles/:id/permissions` | `rbac:manage` | owner edits role permissions |
| GET/POST/PATCH `/admin/users` | `user:manage` | |
| GET/PUT `/admin/settings/:key` | `settings:manage` | value validated against a zod schema per key |
| GET `/admin/audit?resource=&actor=&from=&to=` | `audit:read` | |
| GET `/notifications`, POST `/notifications/:id/read` | own | in-app inbox |
| GET `/events` (SSE) | any logged-in or `/public/events` for the grid only | topics below |

SSE topics: `booking.changed {courtId, date}`, `order.item {station}`, `order.status {orderId}`, `stock.low {variantId}`, `lead.created {leadId}`, `dashboard.tick {}`. Frontend reacts by invalidating the matching TanStack Query keys. Permission is checked when the stream opens and per topic.

### 7.2 Members and plans (Dev A)

| Method + path | perm | Notes |
|---|---|---|
| GET `/plans` | public | plan + entitlements derived from `price_rules` (court rate, shop %, bar %) |
| POST `/members` | `member:create` | body: member + `planCode`; creates membership row + invoice (`InvoiceService`) in one transaction; returns QR token |
| GET `/members?q=` | `member:read` | search by name, phone, member_code |
| GET `/members/:id` | `member:read` or `own` | profile, current plan, status, expiry |
| GET `/members/:id/timeline` | `member:read` | union of bookings, orders, tabs, payments, check-ins, newest first |
| POST `/members/:id/renew`, POST `/members/:id/change-plan` | `member:update` | new dated row, invoice with difference (P1) |
| POST `/members/:id/suspend`, `/reinstate` | `member:update` | |
| POST `/checkins` `{ qrToken | memberId }` | `checkin:create` | returns member card (name, plan, status, expiry) so staff see it instantly (P1) |
| GET `/checkins/current` | `member:read` | P1 |

Jobs: `membership.expire` nightly (`active` and `ends_on < today` -> `expired`, notify); `membership.remind` nightly at the days in `membership.reminder_days`.
Reference behaviour: seltzer (dated tier rows), melgym (renew/switch), gym_management_pro (QR check-in, expiry jobs), MembershipSchemaAndBenefits (junior to guardian).

### 7.3 Courts and bookings (Dev A)

| Method + path | perm | Notes |
|---|---|---|
| GET `/public/availability?date=&courtType=` | public | grid: courts x slots with `free | taken | social(capacity, left)`; **no personal data** |
| GET `/availability?date=` | `booking:read` | same grid plus who booked (staff) |
| POST `/bookings` | `booking:create` (staff) or `booking:create:own` (member) | body `{ courtId, startAt, memberId? , guest? , channel }` |
| POST `/bookings/:id/cancel` | `booking:cancel` or own | applies cancellation policy, refund via `PaymentService.refund` |
| GET `/bookings?from=&to=&memberId=` | `booking:read` or own | |
| POST `/bookings/:id/no-show`, `/complete` | `booking:update` | |
| POST `/bookings/blocks` | `booking:block` | maintenance block (P1) |
| GET/POST `/social/sessions`, POST `/social/sessions/:id/signup`, `/cancel-signup` | staff / own | capacity counter, waitlist promotion on cancel |
| GET/PUT `/admin/courts`, `/admin/court-types` | `court:manage` | |

**Create-booking algorithm (single DB transaction):**
```
1. Validate: startAt on the slot grid (minutes 0 or 30 club-local), within advance window, in the future.
2. If member: SELECT ... FROM members WHERE id=$1 FOR UPDATE   -- serialises this member's concurrent attempts
   - current membership must be 'active' else MEMBERSHIP_INACTIVE
   - count bookings with kind='regular' and status in (held,confirmed,completed,no_show) whose club-local date = date(startAt)
     if count >= plan.daily_booking_limit (fallback settings booking.default_daily_limit) -> DAILY_LIMIT
3. Lazy-expire stale holds on that court/range: UPDATE bookings SET status='expired' WHERE status='held' AND expires_at < now() AND court_id=$c AND during && $range
4. quote = PricingEngine.quote({kind:'court', scopeRef: courtType.code, basePricePaise: courtType.base_price_per_hour_paise, qty:1, memberId, channel, at:startAt})
5. INSERT booking (status 'confirmed', or 'held' with expires_at if payment pending) with price snapshot.
   On error code 23P01 -> throw SLOT_TAKEN (409).
6. invoice = InvoiceService.create({... one 'court' line ...}, tx); if total is 0 the invoice is created already paid.
7. COMMIT. Then Audit.log + Events.publish('booking.changed') + Notifications.send('booking.confirmed').
```
**Cancel:** compute hours until start; pick the first policy row with `hours_before <= hoursUntilStart` (rows sorted descending); refund = paid amount x `refund_pct`; call `PaymentService.refund`; set status `cancelled`; free the slot (constraint ignores cancelled); publish event. Staff may override the refund percent (needs `booking:override_refund`).

**Social play:** a session creates one `bookings` row with `kind='social'` covering the whole window (so the same constraint blocks the court). Signups are capacity-counted under `SELECT ... FOR UPDATE` on the session row. Cancelling a confirmed signup promotes the first waitlisted one and notifies them. Social signups do not count toward the daily limit (toggle in settings if the owner disagrees).

**Booking state machine:** `held -> confirmed -> completed`, `confirmed -> cancelled | no_show`, `held -> expired | cancelled`. Anything else is `INVALID_STATE`.

Reference behaviour: ep3-bs (tennis calendar and billing statuses), easyappointments (services vs providers, slot generation), LibreBooking (quotas, blackouts), alf.io (capacity events), ccasro/hub (status-filtered exclusion constraint plus hold expiry, verified only through a docs mirror).

### 7.4 Pricing (Dev A)

| Method + path | perm | Notes |
|---|---|---|
| POST `/pricing/quote` | `pricing:quote` | thin wrapper over `PricingEngine.quote` for the UI preview |
| GET/POST/PATCH/DELETE `/admin/price-rules` | `pricing:manage` | owner edits discounts and rates; changes take effect immediately |

Seed rules (placeholders the owner can change): court 60-min base by court type; Gold court = 0 (fixed_price) at any time; Silver court = 40% off peak band 17:00 to 21:00 and 60% off otherwise; Junior court = 70% off before 17:00; walk-in = a `fixed_price` rule for the `walkin` tier that is higher in the peak band than off-peak (percent and amount rules only reduce a price, so a surcharge is modelled as a fixed price); shop: Gold 15%, Silver 10%, Junior 5% off; bar: Gold 10%, Silver 5%, Junior 0%.

### 7.5 CRM and public site API (Dev A)

| Method + path | perm | Notes |
|---|---|---|
| POST `/public/enquiries` | public, rate-limited | creates lead (`source='web_form'`), notifies staff in-app, emits `lead.created` |
| POST `/public/trial-bookings` | public, rate-limited | P1: books a slot as a `public` guest and creates lead (`trial_booking`) |
| GET `/leads?stage=&assignedTo=` | `lead:read` | |
| PATCH `/leads/:id` | `lead:update` | stage change writes `lead_activities`; moving to `follow_up` auto-creates a task due +2 days; `lost` requires `lostReason` |
| POST `/leads/:id/notes`, `/tasks`, PATCH `/tasks/:id` | `lead:update` | |
| POST `/leads/:id/quotes`, POST `/quotes/:id/send` | `quote:manage` | send = log email stub + stage `quotation_sent` |
| POST `/leads/:id/convert` | `lead:convert` | creates member + membership + invoice in one transaction |

Reference behaviour: atomic-crm (kanban, tasks, notes), frappe/crm (lead timeline, ideas only, AGPL), cal.diy (public booking page idea), uabc-web (club site with booking flow).

### 7.6 Shop and inventory (Dev B)

| Method + path | perm | Notes |
|---|---|---|
| GET `/public/products`, `/public/products/:id` | public | catalogue with `inStock` boolean only (no counts) |
| GET `/products`, POST/PATCH `/products`, `/variants` | `product:manage` | |
| GET `/stock?lowOnly=` | `stock:read` | from `v_stock` |
| POST `/stock/movements` | `stock:adjust` | purchase / adjustment; writes ledger row; trigger updates `stock_levels` |
| POST `/orders` | `order:create` (staff) or `order:create:own` | `{ items:[{variantId,qty}], fulfilment, address?, memberId? }` |
| POST `/orders/:id/status` | `order:update` | validates the state machine |
| GET `/orders?status=` , GET `/orders/:id` | `order:read` or own | |

**Order algorithm (one transaction):** for each item lock the `stock_levels` row, check `on_hand - reserved >= qty` else `OUT_OF_STOCK`; price each line with `PricingEngine`; insert order and items; insert `sale` movements (counter) or `stock_reservations` (online awaiting payment); `InvoiceService.create` with lines tagged `shop`; if counter and paid, `PaymentService.record`; after commit publish `order.status` and, if `saleable <= threshold`, `stock.low` plus a notification to `shop_clerk` and `manager`.
**State machines:** counter `placed -> collected`; pickup `placed -> ready -> collected`; delivery `placed -> out_for_delivery -> delivered`; any `placed|ready -> cancelled` (restocks via movement).
Reference behaviour: Vendure (on-hand/allocated, thresholds, StockMovement), Solidus (signed ledger), Medusa (reservations), Saleor (click-and-collect), opensourcepos (counter flow). Only borrow ideas.

### 7.7 Bar and cafeteria POS (Dev B)

| Method + path | perm | Notes |
|---|---|---|
| GET/PUT `/admin/menu`, `/admin/tables` | `menu:manage` | |
| POST `/till/open`, POST `/till/close` | `till:manage` | close computes expected cash = float + cash payments in session; stores variance |
| POST `/tabs` | `tab:create` | `{ tableId?, memberId?, guestLabel? }` |
| POST `/tabs/:id/items` | `tab:update` | adds item; price from engine; publishes `order.item {station}` |
| POST `/tab-items/:id/status` | `kds:update` | kitchen and bar screens move `pending -> preparing -> ready`; waiter marks `served` |
| POST `/tab-items/:id/void` | `tab:void` | requires reason; manager approval if after `preparing` (P1) |
| POST `/tabs/:id/settle` | `tab:settle` | `{ payments:[{method,amountPaise}] }`; split payments allowed; creates invoice with `bar` lines then payments |
| POST `/tabs/:id/transfer`, `/merge` | `tab:update` | P1 |
| GET `/kds?station=` | `kds:read` | open items for one station |
| GET `/reports/z?date=` | `report:read` | sales by tender, category, waiter, voids, discounts, tax; CSV export |

A tab with no member is a guest: full price, tenders cash/card/UPI. Members get the discount automatically (engine). "Run a tab" = leave it `open` and settle later. Floor plan view flags tabs open longer than `bar.table_occupied_minutes`.
Reference behaviour: satisfecho/pos (per-item status, kitchen/bar screens, pub/sub bridge), restaurant-pos (floor plan, KDS, day-end), ury (shift open/close, cash reconciliation), opensourcepos (cash-up).

### 7.8 Invoices, payments, tax, finance dashboard (Dev B)

| Method + path | perm | Notes |
|---|---|---|
| GET `/invoices?status=&customer=`, GET `/invoices/:id` | `invoice:read` or own | includes lines, payments, balance, PDF link |
| GET `/invoices/:id/pdf` | `invoice:read` | simple HTML-to-PDF or printable HTML with GST breakup |
| POST `/invoices/:id/payments` | `payment:create` | rejects overpayment (`OVERPAYMENT`) |
| POST `/invoices` | `invoice:create` | manual / corporate invoices |
| CRUD `/business-clients` | `client:manage` | |
| GET `/finance/summary?from=&to=&group=day|week|month` | `finance:read` | `{ charged, collected, outstanding, gstCollected, expenses, profit, payrollDue, bySource[], byMethod[], series[] }` |
| GET `/finance/receivables` | `finance:read` | aging buckets 0-30, 31-60, 61+ |
| GET `/finance/export?from=&to=&format=csv` | `finance:read` | |
| POST `/finance/share` | `finance:share` | creates a read-only signed token link to a snapshot (P1) |
| CRUD `/expenses`, POST `/expenses/:id/approve` | `expense:manage` / `expense:approve` | |
| GET/PUT `/admin/tax-rates` | `tax:manage` | |

**Definitions (put these on the dashboard tooltips):** *Charged* = sum of issued invoice totals. *Collected* = sum of payments (refunds negative). *Outstanding* = charged minus collected. *Revenue (taxable)* = charged minus tax. *GST collected* = CGST + SGST on issued invoices (what we owe the government). *Profit* = taxable revenue minus approved expenses minus payslips for the period. *Owed* = GST collected + payroll due + approved unpaid expenses.
GST math: tax = round(taxable x rate_bps / 10000) computed per line, CGST = floor(tax / 2), SGST = tax - CGST (keeps lines summing exactly). Round to whole paise only.
Reference behaviour: frappe/books (GST split, GSTR-1 style reports, P&L), erpnext (invoice + payment entries, aging), invoiceshelf (estimate -> invoice -> payment), Free-GST-Billing-Software (invoice types, GSTR-1 data), HSN-Code-Package (GST helpers; check licence before using), akaunting (income/expense).

### 7.9 HR: employees, leave, payroll (Dev B)

| Method + path | perm | Notes |
|---|---|---|
| CRUD `/employees`, `/work-shifts`, `/salary-components` | `hr:manage` | |
| GET `/leave/balances?employeeId=` | `hr:read` or own | |
| POST `/leave/requests` | own or `hr:manage` | checks balance; rejects if `days > allotted - used` |
| POST `/leave/requests/:id/approve` or `/reject` | `leave:approve` | approve re-checks balance, increments `used` |
| POST `/payroll/run` `{ month }` | `payroll:run` | creates `payslips` for active employees from components (idempotent per month) |
| GET `/payslips?month=` | `payroll:read` | printable |

Reference behaviour: frappe/hrms (leave policies, salary components, slips), Odoo Time Off docs, orangehrm (UI reference).

---

## 8. Roles and permissions (seed)

Permissions are `resource:action[:own]`. `owner` has everything. Menus in the UI come from `/me.permissions`.

| Permission group | owner | manager | front_desk | shop_clerk | bartender | kitchen | cashier | finance | hr | member |
|---|---|---|---|---|---|---|---|---|---|---|
| member:* | all | all | create, read, update | read | read | - | read | read | - | own read |
| booking:* | all | all | create, read, cancel, update | - | - | - | read | read | - | create/read/cancel own |
| lead:*, quote:* | all | all | all | - | - | - | - | - | - | - |
| product, stock, order | all | all | order:create, read | all | - | - | order:read | read | - | order own |
| menu, tab, till | all | all | - | - | tab, kds | kds | tab:settle, till | read | - | read own tab |
| invoice, payment | all | all | payment:create, invoice:read | payment:create | - | - | all | all | - | invoice own read |
| finance, expense, report | all | read | - | - | - | - | report:read | all | - | - |
| hr, leave, payroll | all | leave:approve | - | - | - | - | - | payroll:read | all | - |
| rbac, settings, pricing, audit | all | pricing, settings (not rbac) | - | - | - | - | - | audit:read | - | - |

Row-level `own` means `resource.memberId == user.memberId`. A permission test must prove a `member` user receives `FORBIDDEN` when requesting another member's data.

---

## 9. Realtime, jobs, notifications

**Jobs (node-cron, all idempotent):** `membership.expire` 00:05 daily; `membership.remind` 09:00 daily; `booking.expireHolds` every minute; `stock.lowCheck` every 5 minutes (also event-driven on movement); `crm.overdueTasks` hourly (notify assignee); `bar.longOccupied` every 5 minutes.
**Templates (notifications):** `booking.confirmed`, `booking.cancelled`, `membership.expiring`, `membership.expired`, `lead.new`, `lead.task_due`, `stock.low`, `order.ready`, `leave.decision`, `quote.sent`. Channel adapters: `inapp` (real), `email`/`sms`/`whatsapp` (log to console and store; interface identical so a real provider can be dropped in).

---

## 10. Frontend specification (Dev C, frontend only)

One Vite app, three areas sharing one component library and one typed API client.

### 10.1 Principles
- **Mock first.** Backend is not ready in the first hours. Build every screen against MSW handlers that return `packages/contract/src/fixtures/*`. Switch an endpoint to the real API by deleting its handler. Never block waiting for a backend teammate.
- **No business logic in the browser.** Prices, discounts, limits, balances and tax come from the API. The UI shows `breakdown[]` as returned.
- **Permission aware.** Read `/me.permissions`; build the sidebar from it; hide actions the user cannot perform; still render API `FORBIDDEN` errors as a toast.
- **Server state in TanStack Query.** Key naming: `['availability', date]`, `['bookings', filters]`, `['kds', station]`, etc. The SSE hook invalidates keys by topic (see 7.1).
- **Errors:** map API error `code` to friendly messages (`SLOT_TAKEN` -> "That slot was just taken, pick another" and refetch the grid).
- **Design:** start from the `shadcn-admin` layout. Tablet-friendly big tap targets on POS, kitchen and front-desk screens. Dark mode optional (P2).
- Reusable pieces to build first: `DataTable` (filters, pagination), `FormField` helpers with zod, `MoneyText` (paise -> `₹1,234.50`), `StatusBadge`, `PriceBreakdown` popover, `useSSE`, `PermissionGate`.

### 10.2 Screens by area (build in this priority order)

**A. Staff console `/admin/*`**
1. **Login, shell, sidebar** from permissions. [P0]
2. **Court grid** `/admin/courts`: date picker, courts as columns, half-hour rows, colours for free / booked / social / blocked / held; click a free cell -> booking drawer (member search or walk-in name+phone, shows price quote and breakdown before confirming); click a booking -> details, cancel with refund preview. Live-updates via SSE. [P0, the showpiece]
3. **Front desk** `/admin/desk`: one search box (name, phone, member code, or scan QR input) -> member card (photo, plan badge, status colour, expiry, discount summary) -> timeline tabs (bookings, orders, tabs, payments). Buttons: Book court, Renew, New order, Check-in. [P0]
4. **New member** wizard `/admin/members/new`: details -> plan cards with entitlements -> confirm -> invoice view with "Record payment". [P0]
5. **Shop POS** `/admin/shop/pos`: product grid with variant picker, cart, member lookup (discount appears automatically), tender, receipt. **Orders board** `/admin/shop/orders` (placed / ready / out for delivery columns with status buttons). **Inventory** `/admin/shop/stock` with low-stock chips and "add stock" dialog. [P0]
6. **Bar POS** `/admin/bar`: floor plan of tables (occupied-too-long highlight), open tab screen (menu grid, items with status chips, add/void), settle dialog (split tenders: cash/card/UPI). **Kitchen** `/admin/kds/kitchen` and **Bar screen** `/admin/kds/bar`: big cards, newest first, sound on new item, one tap to advance status. **Till** open/close and **Z-report**. [P0]
7. **CRM board** `/admin/crm`: Kanban by stage (drag to move), lead page with timeline, tasks, quote builder, "Convert to member". Notification bell. [P0]
8. **Owner dashboard** `/admin/dashboard`: range switcher (today / week / month / custom); KPI tiles (charged, collected, outstanding, expenses, profit, GST collected); stacked chart by source; chart by payment method; low-stock and expiring-memberships lists; receivable aging; export CSV and share link buttons. Updates live on `dashboard.tick`. [P0]
9. **Invoices** list and detail (lines, GST, payments, balance, print view). **Expenses** with approve. [P0]
10. **HR**: employees, rota, leave requests with approve/reject, payroll run and payslip view. [P0 thin]
11. **Settings**: plans, price rules, cancellation policy, tax rates, roles and permissions matrix, social play windows, CRM stages. Audit log viewer. [P0 thin: table + edit form each]

**B. Member portal `/me/*`** [P0 thin]
- Dashboard (plan, expiry countdown, upcoming bookings), book a court (same grid component, read-only for others), my bookings (cancel), shop (order with pickup or delivery), my invoices, notifications.

**C. Public site `/` (no login)** [P0]
- Home with hero and "Book a trial" call to action; plans and prices (from `/plans`); this week's availability (public grid); shop catalogue (in-stock badge); contact/enquiry form; trial booking (P1). Set page titles, meta descriptions and JSON-LD `SportsActivityLocation` (it is a SPA, so say so honestly if asked about SEO).

### 10.3 Contract workflow
- `packages/contract` exports for each endpoint: `{ method, path, request, response }` zod schemas plus a fixture. The API client is `api.<module>.<call>()` typed from those.
- If a screen needs a field that is not in the contract, Dev C opens a PR on the contract file and pings the owner; the owner approves within 15 minutes or proposes a change.

---

## 11. Team split

### 11.1 Roles

| Person | Owns | Also responsible for |
|---|---|---|
| **Dev A** | Platform and bookings: core (auth, RBAC, audit, settings, notifications, events/SSE, jobs), members and plans, courts, bookings, social play, pricing engine, CRM and public enquiry API | repo scaffold, docker, `db:reset`, error format, contract for their modules, seed for their modules |
| **Dev B** | Commerce and money: shop and inventory, bar POS and KDS, invoices, payments, GST, finance dashboard API, expenses, business clients, HR (leave, payroll) | contract for their modules, seed for their modules, Z-report, CSV exports |
| **Dev C** | Entire frontend (section 10) | MSW mocks, UI kit, demo rehearsal and the demo script (section 14.3) |

### 11.2 Directory ownership (do not edit outside your area)

| Path | Owner |
|---|---|
| `apps/api/src/core/**`, `modules/{members,courts,bookings,social,pricing,crm}/**`, `db/schema/{core,members,courts,pricing,crm}.ts`, `db/sql/{00,10}_*`, `db/seed/{core,members,courts,pricing,crm}.ts` | Dev A |
| `apps/api/src/modules/{shop,inventory,bar,invoices,payments,tax,finance,expenses,hr}/**`, `db/schema/{shop,bar,invoices,hr}.ts`, `db/sql/{20,30}_*`, `db/seed/{shop,bar,invoices,hr}.ts` | Dev B |
| `apps/web/**` | Dev C |
| `packages/contract/src/<module>.ts` | the owner of that module; Dev C may PR small additions |
| `docker-compose.yml`, root configs, `DECISIONS.md` | Dev A (anyone may append to DECISIONS.md) |

### 11.3 Work packages and order

**Phase 0, hours 0 to 2: scaffold and contract freeze (all three together, then split)**
- Dev A: monorepo, docker-compose, Fastify skeleton, `db:reset`, error handler, session auth stub. Writes `contract` for auth, members, courts, bookings, pricing, crm, admin.
- Dev B: writes `contract` for shop, bar, invoices/payments, finance, hr and the `InvoiceService`/`PaymentService` interface file. Drafts schema files.
- Dev C: Vite app, shadcn-admin shell, MSW wiring, typed client from contract, `PermissionGate`, `useSSE`.
- **Gate at hour 2:** all contract files merged and frozen; `pnpm dev` starts web + api; login page shows.

**Phase 1, hours 2 to 8: foundations and the showpiece**
- Dev A: real auth + `/me` + RBAC seed (**done by hour 3**, Dev C needs it); audit wrapper; settings; events/SSE; notifications; members + plans + membership expiry job; `PricingEngine` (**done by hour 6**); start bookings.
- Dev B: schema + SQL (views, triggers); `InvoiceService` + `PaymentService` + tax (**done by hour 5**, Dev A depends on it); products/variants/stock ledger/stock trigger; catalogue endpoints.
- Dev C: login/shell, UI kit, court grid (against mocks), front desk lookup, new-member wizard.

**Phase 2, hours 8 to 16: scene slices**
- Dev A: bookings (algorithm, cancel, concurrency test), social play, public availability, CRM + public enquiries + quotes + convert, notifications templates.
- Dev B: orders and fulfilment, stock low alerts, bar tabs + KDS + till + Z-report, payments split, finance summary and receivables.
- Dev C: switch court grid and desk to real API as endpoints land; shop POS and orders board; bar POS, KDS screens, till; CRM board.

**Phase 3, hours 16 to 20: money, people, public**
- Dev A: member portal endpoints (`own` scopes), trial booking (P1), renew/change plan (P1), check-ins (P1), audit viewer API, hardening.
- Dev B: dashboard polish, expenses, business clients + aging, HR leave + payroll, CSV export, share link (P1), GSTR-1 summary (P1).
- Dev C: owner dashboard, invoices, expenses, HR screens, settings and roles screens, member portal, public site.

**Phase 4, hours 20 to 24: seed, test, rehearse (feature freeze at hour 20)**
- Everyone: run `db:reset` with full seed; walk the demo script (14.3) three times; fix only demo-breaking bugs; record a backup screen recording; write README with the run steps.
- Dev A: concurrency test and daily-limit test green. Dev B: stock and overpayment tests green. Dev C: empty/error/loading states on every demo screen, mobile check of public site.

### 11.4 Hand-offs that can block people
| Needed by | Needed from | Deadline | Workaround until then |
|---|---|---|---|
| Dev C | `/auth/login`, `/me` | hour 3 | MSW returns a fake owner |
| Dev A (bookings, members) | `InvoiceService`, `PaymentService` | hour 5 | in-memory stub returning ids and totals |
| Dev B (shop, bar) | `PricingEngine` | hour 6 | stub returns base price |
| Dev C | Seed with realistic data | hour 12 | MSW fixtures |
| Everyone | Contract changes | any time | PR + ping; keep additive (new optional fields only) |

### 11.5 Git rules
Trunk-based on `main`. Small commits, rebase before push, no force-push. Branch only for risky changes. CI is not required; run `pnpm typecheck && pnpm test` before pushing. If `db/schema` changes, post in chat and everyone runs `pnpm db:reset`.

---

## 12. Definition of done (per feature)
1. Endpoint implemented with zod request/response from the contract, permission check, audit entry, event if listed.
2. At least one test for its main invariant (list in 14.1).
3. Present in seed data so the demo screen is not empty.
4. Frontend can call it (Dev C confirms), including the error path.

---

## 13. Prompts to paste into coding agents

Give every agent this file plus the prompt for the person it works for.

**Dev A's agent**
> You are building the platform and booking half of the Champions Club backend. Read CHAMPIONS_CLUB_ARCHITECTURE.md sections 1 to 9 and obey section 4 as hard rules. You own the paths listed for Dev A in 11.2 and nothing else. Build in the order of 11.3. Implement the booking algorithm in 7.3 exactly, including the exclusion constraint in 5.3 and a test that fires 20 parallel inserts at one slot and asserts exactly one succeeds and 19 get `SLOT_TAKEN`. Implement `PricingEngine` as described in section 6 with a table-driven test over tier x channel x time band. Use the service interfaces in section 6 for anything owned by Dev B (stub them until they land). Never hardcode a business rule that belongs in `settings` or `price_rules`. Log every decision you make that is not in this file to DECISIONS.md.

**Dev B's agent**
> You are building the commerce and money half of the Champions Club backend. Read CHAMPIONS_CLUB_ARCHITECTURE.md sections 1 to 9 and obey section 4 as hard rules. You own the paths listed for Dev B in 11.2 and nothing else. Ship `InvoiceService` and `PaymentService` first (section 6) because Dev A depends on them. Stock and payments are append-only ledgers; `stock_levels` and invoice balances are derived (triggers and views in `db/sql`). Money is integer paise; GST is CGST+SGST per line with the rounding rule in 7.8. Write tests that prove stock can never go negative under parallel orders and a payment can never exceed the amount due. Use `PricingEngine` for every price (stub it until Dev A lands it). Log every decision not in this file to DECISIONS.md.

**Dev C's agent (frontend only)**
> You are building the entire frontend of the Champions Club in `apps/web`. Read CHAMPIONS_CLUB_ARCHITECTURE.md sections 1, 3, 4, 8 and 10. Work mock first with MSW from `packages/contract` fixtures, then switch endpoints to the real API as backend teammates ship them. Never compute prices, discounts, taxes, limits or balances in the browser: render what the API returns. Build in the priority order in 10.2, starting with the court grid. Use shadcn-admin as the layout base, TanStack Router and Query, zod from the contract, and the `useSSE` hook to invalidate queries on realtime topics. Hide UI the user lacks permission for, but always handle `FORBIDDEN`. Every screen needs loading, empty and error states. If the contract lacks a field you need, open a small PR on the contract file and ping its owner.

---

## 14. Tests, seed data and the demo

### 14.1 Tests that must pass (these are the claims in the brief)
| # | Test | Owner |
|---|---|---|
| T1 | 20 parallel bookings for one court/slot: exactly 1 succeeds, 19 `SLOT_TAKEN` | A |
| T2 | Adjacent slots (10:00-11:00 and 11:00-12:00) both succeed (half-open ranges) | A |
| T3 | Third booking by a member on the same club-local day returns `DAILY_LIMIT`; parallel attempts cannot exceed 2 | A |
| T4 | Expired/suspended member cannot book and is priced as walk-in elsewhere | A |
| T5 | Price matrix: Gold/Silver/Junior/walk-in x peak/off-peak x counter/online returns the seeded expected values | A |
| T6 | Cancellation refunds follow the policy rows; refund is a negative payment | A |
| T7 | Social session: capacity respected, waitlist promoted on cancel, court blocked for regular bookings | A |
| T8 | 10 parallel orders for the last 3 units: stock never negative, extras get `OUT_OF_STOCK` | B |
| T9 | Payment above outstanding returns `OVERPAYMENT`; partial payments sum correctly; charged/paid/outstanding match the view | B |
| T10 | GST lines sum exactly to invoice totals (CGST+SGST) | B |
| T11 | Till close variance equals counted minus expected | B |
| T12 | Leave request over balance is rejected | B |
| T13 | RBAC: member cannot read another member's data; unauthenticated gets 401; deny by default for an unknown permission | A |
| T14 | Every write path creates an audit row | A and B |

### 14.2 Seed data (`pnpm db:reset` produces this; makes the dashboard look alive on first click)
- 8 courts: tennis x3, padel x2, badminton x2, cricket nets x1 (proves court types are data).
- 40 members: Gold 10, Silver 18, Junior 8 (with guardians), 4 expired or suspended; memberships with expiry dates spread so a few are within 7 and 30 days.
- A week of bookings around "now" (relative dates so the seed works on demo day): tonight 6 to 9 pm nearly full with 3 free slots; a Friday social session 14/16 full with 2 on the waitlist; some past completed bookings and a few cancellations with refunds.
- 25 products with variants; 3 variants at or below threshold; a couple of pickup and delivery orders in different states.
- Bar: 20 menu items (food and drink), 6 tables, 4 open tabs with items in mixed statuses, one settled split-payment tab, one till session closed with a small variance.
- Finance: invoices across all five sources and across the month, some partial and some unpaid (aging buckets populated), 3 business clients, 12 expenses (some pending approval), 8 employees with salary components and leave balances, 3 pending leave requests, last month's payslips.
- CRM: 6 leads across stages with timelines, 2 open tasks (one overdue), 1 draft quote.
- Users: one login per role, password `demo1234`, listed in README.

### 14.3 Demo script (rehearse three times; each scene is one vertical slice)
1. **New member walks in:** front desk creates "Aarav Mehta", picks Silver; plan card shows entitlements; invoice appears; record UPI payment; member card shows plan, status, expiry. Open an older member to show history and a "membership expiring in 6 days" badge.
2. **6 pm rush:** open the court grid; book a Gold member (price 0, breakdown shown), a walk-in (walk-in price), then try a third booking for the same Gold member (blocked with the daily-limit message); open a second browser and race the same slot (second gets "slot just taken", grid updates live). Show the Friday social session with capacity and waitlist. Cancel a booking and show the refund.
3. **Gear up:** member portal orders shoes for pickup; staff board shows it; mark ready then collected; stock drops; a racket string hits low stock and the alert pops up. Counter sale gives the member discount automatically.
4. **Bar:** open a tab for a member, add items from a tablet; kitchen screen receives food and bar screen receives drinks; advance statuses; settle with split cash + UPI; close the till and show the Z-report.
5. **Stranger online:** public site on phone width: plans, this week's availability, shop; submit "Book a trial"; staff bell rings; lead appears in New; move through Follow-up, send a quote, convert to member.
6. **Owner at month end:** dashboard: charged vs collected vs outstanding, by source and by payment method, GST collected, expenses, profit; live tick as a new sale lands; receivable aging; approve an expense and a leave request; run payroll; export CSV and share link.
7. **Admin:** change the Silver court discount in Settings and show the grid price update; edit a role permission and show the menu change; open the audit log and show the entries from this demo.

---

## 15. Cut list and risks

**If behind schedule, cut in this order:** (1) share link, GSTR-1 summary, CSV beyond one report; (2) member portal ordering delivery (keep pickup); (3) renew/change-plan proration; (4) merge/transfer tabs; (5) trial booking; (6) recurring and blocks; (7) payroll detail (keep a single payslip view); (8) purchase orders and returns (already P2).
**Never cut:** the exclusion constraint and T1 to T3; the single pricing engine; invoices + payments with charged/paid/outstanding; roles as data; audit log; the court grid with live updates; seed data.

| Risk | Mitigation |
|---|---|
| Backend not ready for the frontend | mock-first, contract frozen at hour 2 |
| Dev A overloaded | Dev B takes over CRM first (it is independent), then notification templates |
| Timezone bug on the daily limit | all day maths in `lib/clubTime.ts`; test around midnight IST |
| `drizzle-kit push` surprises | always `db:reset`; constraints live in `db/sql` |
| Licence trouble | AGPL repos are idea-only; no code copied |
| Demo-day data looks stale | seed uses dates relative to "now" |

---

## 16. References (ideas, not code to copy unless the licence allows)

Verified = a page was fetched in research. "Via index/mirror" = confirmed only through a search result or docs mirror; open it before relying on it. AGPL repos (Frappe CRM, EspoCRM, SuiteCRM, Satisfecho, Cal.com `/ee`) are idea-only.

| Module | Repo / source | Take |
|---|---|---|
| Booking | github.com/ccasro/hub (via mirror) | exclusion constraint filtered by status, hold `expires_at`, partial indexes |
| Booking | github.com/tkrebs/ep3-bs | tennis court calendar, billing statuses |
| Booking | github.com/alextselegidis/easyappointments | services vs providers, slot generation |
| Booking | github.com/LibreBooking/app | quotas, blackouts |
| Booking | github.com/alfio-event/alf.io | capacity events, check-in (social play) |
| Booking | postgresql.org/docs/current/ddl-constraints.html; cybertec-postgresql.com exclusion constraints article | constraint syntax, `btree_gist` |
| Booking UI | `@daypilot/daypilot-lite-react` (resource calendar, open source); github.com/ansulagrawal/react-big-schedule (MIT) | optional grid component; a custom CSS grid is also fine |
| Booking UX | BoardIt (WordPress plugin, not GitHub); PlaySport case study (contra.com, not a repo) | self-refreshing board, auto-assign court, online vs front-desk payments |
| Membership | MemberMatters, seltzer, melgym, gym_management_pro, laravel-gymie, SFDO MembershipSchemaAndBenefits | dated tier rows, renew/switch, expiry jobs, QR check-in, guardian link |
| Shop | Vendure, Solidus, Medusa, Saleor, Sylius, opensourcepos | stock ledger, on-hand/reserved, reservations, click-and-collect, member price rules |
| Bar | satisfecho/pos, ahmedali5530/restaurant-pos, genforge/ury, opensourcepos, floreantpos | per-item status, KDS, floor plan, shift cash reconciliation, Z-report |
| CRM | marmelab/atomic-crm (fetched via a fork), frappe/crm, chatwoot, cal.diy, UoaWDCC/uabc-web (via mirror) | kanban, lead timeline, tasks, public booking widget |
| Finance | frappe/books, frappe/erpnext, invoiceshelf, akaunting, kimai | GST split, invoice + payments, aging, rate cards |
| GST helpers | github.com/karthi-21/HSN-Code-Package; github.com/IamRamgarhia/Free-GST-Billing-Software (MIT) | CGST/SGST maths, GSTIN validation, invoice types, GSTR-1 data. Check licences; keep rates in `tax_rates` |
| HR | frappe/hrms, Odoo Time Off docs, orangehrm | leave balances and approval, salary components, payslips |
| Admin | directus, CASL, casbin, better-auth, novu, refine, shadcn-admin, spatie activitylog/permission | permissions as rows, `can()`, audit shape, notification interface, admin shell |

**Open these before relying on them:** Zaryab03/gym_management_pro, southlondonmakerspace/membership-system, UoaWDCC/uabc-web, Invoice Ninja, Firefly III, django-auditlog, ccasro/hub. Several gym and club repos are tiny coursework projects; use them as feature checklists only.

this is the file structure and who owns it..


champions-club/
├── README.md
├── DECISIONS.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── docs/
│   └── CHAMPIONS_CLUB_ARCHITECTURE.md
│
├── packages/
│   └── contract/                      # ALL (frozen at hour 2)
│       └── src/
│           ├── common.ts              # errors, pagination, money types
│           ├── auth.ts                # A
│           ├── members.ts             # A
│           ├── courts.ts              # A
│           ├── bookings.ts            # A
│           ├── pricing.ts             # A
│           ├── crm.ts                 # A
│           ├── admin.ts               # A
│           ├── shop.ts                # B
│           ├── bar.ts                 # B
│           ├── finance.ts             # B (invoices, payments, expenses)
│           ├── hr.ts                  # B
│           └── fixtures/              # example responses for mocks and tests
│
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.ts
│   │   │   ├── core/                  # A
│   │   │   │   ├── auth/
│   │   │   │   ├── rbac/
│   │   │   │   ├── audit/
│   │   │   │   ├── settings/
│   │   │   │   ├── notifications/
│   │   │   │   ├── events/            # SSE
│   │   │   │   ├── jobs/
│   │   │   │   ├── errors.ts
│   │   │   │   └── clubTime.ts
│   │   │   ├── modules/
│   │   │   │   ├── members/           # A
│   │   │   │   ├── courts/            # A
│   │   │   │   ├── bookings/          # A
│   │   │   │   ├── social/            # A
│   │   │   │   ├── pricing/           # A
│   │   │   │   ├── crm/               # A
│   │   │   │   ├── shop/              # B
│   │   │   │   ├── inventory/         # B
│   │   │   │   ├── bar/               # B
│   │   │   │   ├── invoices/          # B
│   │   │   │   ├── payments/          # B
│   │   │   │   ├── tax/               # B
│   │   │   │   ├── finance/           # B
│   │   │   │   ├── expenses/          # B
│   │   │   │   └── hr/                # B
│   │   │   └── db/
│   │   │       ├── schema/
│   │   │       │   ├── core.ts        # A
│   │   │       │   ├── members.ts     # A
│   │   │       │   ├── courts.ts      # A
│   │   │       │   ├── pricing.ts     # A
│   │   │       │   ├── crm.ts         # A
│   │   │       │   ├── shop.ts        # B
│   │   │       │   ├── bar.ts         # B
│   │   │       │   ├── invoices.ts    # B
│   │   │       │   └── hr.ts          # B
│   │   │       ├── sql/
│   │   │       │   ├── 00_ext.sql           # A
│   │   │       │   ├── 10_constraints.sql   # A
│   │   │       │   ├── 20_views.sql         # B
│   │   │       │   └── 30_triggers.sql      # B
│   │   │       └── seed/
│   │   │           ├── index.ts
│   │   │           ├── core.ts, members.ts, courts.ts, pricing.ts, crm.ts   # A
│   │   │           └── shop.ts, bar.ts, invoices.ts, hr.ts                  # B
│   │   └── test/
│   │
│   └── web/                           # C (frontend only)
│       ├── package.json
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── api/                   # typed client + MSW handlers
│           ├── auth/                  # session, PermissionGate
│           ├── hooks/                 # useSSE, etc.
│           ├── lib/
│           ├── components/            # DataTable, MoneyText, StatusBadge, PriceBreakdown
│           └── routes/
│               ├── public/            # home, plans, availability, shop, contact
│               ├── portal/            # member portal (/me)
│               └── admin/             # staff console
│                   ├── courts/        # grid
│                   ├── desk/          # front desk lookup
│                   ├── members/
│                   ├── shop/          # POS, orders, stock
│                   ├── bar/           # POS, kitchen, bar screen, till
│                   ├── crm/
│                   ├── finance/       # dashboard, invoices, expenses
│                   ├── hr/
│                   └── settings/      # plans, price rules, roles, audit




meow meow moew