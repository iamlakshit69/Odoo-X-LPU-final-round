# Champions Club: Repo Research and Best Features (all 7 modules)

Research date: 2026-11-21. Star counts are approximate and come from the pages the research agents could fetch.
"Verified" = GitHub page or index page fetched. "Design ref" = idea only, not code to lift (licence, age, or archived).
Licence warning: several repos are AGPL (Frappe CRM, EspoCRM, SuiteCRM, Satisfecho, Cal.com /ee). Copy ideas, not code.

---

## 01 Membership

| Repo | Stars | Stack | Take from it |
|---|---|---|---|
| github.com/membermatters/MemberMatters | ~93 | not confirmed | membership + access + payments in one portal; status drives access |
| github.com/elplatt/seltzer | n/a | n/a | dated membership-level rows (tier history), dues billing, emergency contact |
| github.com/apfirebolt/gym_management_system | n/a | Django, DRF, Celery | Celery job notifying due members |
| github.com/cazonda/melgym | n/a | Django | plan = duration + price, one-click renew/switch |
| github.com/jonpecson/laragym | fork | Laravel, React | billing cycles per package, "who is in now" view |
| github.com/Zaryab03/gym_management_pro | n/a | Frappe | QR check-in, scheduled expiry jobs, invoice per membership |
| github.com/southlondonmakerspace/membership-system | n/a | Node | event log of member activity |
| github.com/rvalledorjr/laravel-gymie | n/a | Laravel | cron flips subscriptions to expired |
| github.com/shz-code/fitness-kingdom-gym-ms | 4 | Django | every staff action checks member status first |
| github.com/SFDO-Community-Sprints/MembershipSchemaAndBenefits | 31 | schema only | one membership linked to several people (junior + guardian) |

Best features
1. Plans as data (tier, duration, price, billing cycle, discounts, daily booking limit). Nothing hardcoded.
2. Benefits table per plan so new tiers need no code.
3. Explicit states: active, expired, suspended, cancelled, flipped by a scheduled job.
4. Every upgrade/downgrade is a new dated row (history preserved, price difference computed).
5. One-click renew and plan switch.
6. Expiry reminders at 30/7 days as background jobs.
7. QR / member ID card, check-in log, "currently in club" view.
8. Status-gated actions: suspended or expired members cannot book or get discounts.
9. Per-member activity log (feeds the front-desk history view).
10. Junior-to-guardian link.
11. Invoice auto-generated on join/renew.

## 02 Court booking

| Repo | Stars | Stack | Take from it |
|---|---|---|---|
| github.com/tkrebs/ep3-bs | ~215 | PHP, Zend, MySQL | closest match: tennis court calendar, concurrent-booking limit, billing statuses |
| github.com/alextselegidis/easyappointments | ~3.6k | PHP, CodeIgniter | services vs providers (court types vs courts), REST API, slot generation |
| github.com/LibreBooking/app | ~839 | PHP | quotas, waitlists, blackout times, usage reports, ICS export |
| github.com/alfio-event/alf.io | n/a | Java, Spring, Postgres | capacity-limited events (social play), pay-at-venue, check-in |
| calcom/cal.com (seen via prisma/cal.com fork) | n/a | Next.js, Prisma, Postgres | reminders, Playwright e2e tests, schema design. Not fetched canonical. |

Best features
1. **Postgres exclusion constraint** on (court_id, tstzrange(start,end,'[)')) for held/confirmed rows, using btree_gist. Catch error 23P01 and show "slot just taken". None of the repos do this; it is the one thing to add ourselves (reference: dev.to article "Preventing double bookings with PostgreSQL exclusion constraints").
2. Half-open ranges on a 30-min grid, validate 60-min duration.
3. Max 2 sessions/member/day enforced in the same transaction (lock the member row).
4. Short-lived "held" status with expiry, in the same constraint.
5. One availability grid (court x time), used by staff and the public site.
6. Tier x time-band x day-type pricing resolved server-side; snapshot price on the booking.
7. Billing statuses: pending, paid, refunded, comped.
8. Cancellation policy as data (hours before start -> refund %).
9. Social play: event with capacity counter, waitlist, promotion on cancel; court blocked for the whole session.
10. Recurring bookings as individual rows, each checked by the constraint.
11. Realtime slot updates (WebSocket / LISTEN-NOTIFY); DB stays source of truth.
12. Concurrency test: parallel inserts for one slot, exactly one wins.

## 03 Sports shop and inventory

| Repo | Stars | Stack | Take from it |
|---|---|---|---|
| github.com/medusajs/medusa | ~36.5k | TypeScript | stocked / reserved / incoming per location, reservation rows, modular commerce |
| github.com/saleor/saleor | ~23.4k | Python, GraphQL | allocation at checkout, click-and-collect as a pickup warehouse, channels |
| github.com/vendurehq/vendure | ~8.5k | TS, NestJS | on-hand / allocated / saleable, out-of-stock threshold, StockMovement ledger, draft orders |
| github.com/solidusio/solidus | ~5.3k | Rails | signed stock-movement ledger, return authorization then receipt |
| github.com/Sylius/Sylius | ~8.6k | PHP, Symfony | catalog vs cart promotions, separate order/payment/shipping state machines |
| github.com/inventree/InvenTree | ~7.7k | Django, React | purchase orders, supplier parts, barcodes (PO details from background knowledge) |
| github.com/opensourcepos/opensourcepos | ~4.4k | PHP | receiving, cash-up, receipts, item kits |

Best features
1. Append-only stock movement ledger; on-hand derived from entries.
2. Three numbers: on hand, reserved, saleable = on hand - reserved - buffer.
3. Reservation rows at checkout that expire, convert to sale on fulfilment.
4. One catalogue and stock pool, two channels (web, counter).
5. Variants (size/colour), one SKU each.
6. Per-variant low-stock threshold doubling as alert level.
7. Click-and-collect as a delivery method with "ready" then "collected".
8. Separate state machines for order, payment, fulfilment.
9. Two promo layers: catalogue price rules (member price) and cart rules; same engine for web and counter.
10. Purchase orders with "incoming" qty; receiving writes a ledger entry.
11. Two-stage returns: authorise, receive, then restock/write-off/refund.
12. Staff draft orders for phone/counter sales.
Hackathon core: 1-4, 6, 7, 9. Stub the rest.

## 04 Bar and cafeteria POS

| Repo | Stars | Stack | Take from it |
|---|---|---|---|
| github.com/ahmedali5530/restaurant-pos | ~52-77 | React, TS, SurrealDB | floor plan, split by seat, KDS stages, offline-first, day-end close |
| github.com/satisfecho/pos | ~62 | Angular, FastAPI, Postgres, Redis | per-item status, Redis pub/sub + WebSocket bridge, /kitchen and /bar screens, CSV reports |
| github.com/genforge/ury (fork of navariltd/ury) | fork | ERPNext | shift open/close, cash reconciliation, long-occupied table flag |
| github.com/opensourcepos/opensourcepos | ~3.7k | PHP | cash-up, expense log, per-user permissions |
| github.com/fat-tire/floreantpos | ~64 | Java | cash drawer per staff, split tickets (features from a third-party write-up) |
| github.com/DanMat/Restaurant-Management-System | ~44 | PHP | low priority, description only |

Best features
1. Per-item order status (pending, preparing, ready, delivered, paid); soft-delete items.
2. Realtime via WebSocket/SSE (plain is fine for 24h).
3. Separate kitchen and bar screens, big cards, new-order sound.
4. Open tab per table or member; add items to an open order.
5. Split bills and partial payments; merge/transfer tabs.
6. Shift open/close with cash reconciliation (shortage/excess).
7. Daily Z-report by cash/card/UPI, voids, discounts, by waiter and category; CSV export.
8. Member discount auto-applied from the shared pricing engine.
9. Role permissions: waiter, bartender, kitchen, cashier, manager.
10. Floor plan with occupied-too-long flag.
11. Optional: offline-first. UPI is not in any repo; add it as a tender type ourselves.

## 05 Public website and CRM

| Repo | Stars | Stack | Take from it |
|---|---|---|---|
| github.com/marmelab/atomic-crm (fetched via fork copilotkit/atomic-crm) | ~21 (fork) | React, Supabase | best fit for 24h: kanban, tasks, notes, small data model |
| github.com/frappe/crm | ~3.4k | Frappe, Vue | lead page with activity timeline, kanban, saved views, WhatsApp |
| github.com/twentyhq/twenty | ~60.9k | NestJS, Postgres, BullMQ | custom fields, saved views, job queue (design ref, heavy) |
| github.com/espocrm/espocrm | ~3.6k | PHP | lead conversion, shared calendar, email archive |
| github.com/krayin/laravel-crm | ~24.1k | Laravel, Vue | email-to-lead, WhatsApp-to-lead |
| github.com/salesagility/SuiteCRM | ~5.9k | PHP | quotes module idea (not confirmed), legacy |
| github.com/chatwoot/chatwoot | ~40k | Rails | multi-channel inbox, routing, canned replies |
| github.com/calcom/cal.diy | ~50k | Next.js, Prisma | public booking page, embeddable availability |
| github.com/UoaWDCC/uabc-web | n/a | Next.js, PayloadCMS | real badminton club site with booking flow (URL inferred via mirror) |
| github.com/dresnite/boxing-website | 3 | Next.js | landing page layout only |

Best features
1. Kanban with stages from config (New, Contacted, Quotation sent, Follow-up, Converted, Lost).
2. One lead page with combined timeline: notes, tasks, calls, messages.
3. Follow-up tasks with due dates; auto-create when a lead enters Follow-up.
4. Convert lead to member in one step.
5. Public web-form lead capture lands in New with source recorded.
6. Lead assignment (round-robin or availability).
7. Trial booking: pick a slot, create lead + booking, confirm.
8. Public availability widget reading the same bookings table (no separate calendar).
9. Quotation from line items, PDF/email, moves lead to Quotation sent.
10. One notification sender interface (email, WhatsApp, SMS) with templates.
11. Required reason when marking Lost (our suggestion, not from a repo).
12. Responsive, SEO-friendly public site with a "Book a trial" call to action.

## 06 Finance and HR

| Repo | Stars | Stack | Take from it |
|---|---|---|---|
| github.com/frappe/erpnext | ~40k | Frappe | double-entry under documents, invoice + payment entries, receivable aging |
| github.com/frappe/hrms | ~8.7k | Frappe | leave policies/balances, salary components, salary slips, expense claims |
| github.com/frappe/books | ~5k | Electron, Vue, SQLite (archived per page) | GST reports GSTR-1 style, CGST/SGST/IGST split, P&L, CSV/JSON export |
| github.com/invoiceninja/invoiceninja | ~10.3k | Laravel, React | invoices, quotes, partial payments (repo page not fetched directly) |
| github.com/akaunting/akaunting | ~8.6k | Laravel, Vue | modular apps, income/expense ledger |
| github.com/invoiceshelf/invoiceshelf | ~1.8k | Laravel | estimate to invoice to payment |
| github.com/kimai/kimai | ~5.1k | Symfony | rates per customer/project (maps to member/peak/off-peak) |
| github.com/orangehrm/orangehrm | ~1k | PHP | UI reference for leave |
| github.com/firefly-iii/firefly-iii | n/a | PHP | rules engine for auto-categorising (not fetched directly) |
| github.com/actualbudget/actual | ~29k | Node | core logic separated from UI |
| Odoo Time Off docs (not a fetched repo) | n/a | n/a | leave types, accrual, approval modes |

Best features
1. Revenue-source tag on every transaction (membership, court, shop, bar, corporate).
2. Separate charged / paid / outstanding on every transaction (matches the PDF's warning).
3. Invoices with line items, per-item tax, partial payments via linked payment rows.
4. Receivables with aging buckets and an "outstanding" tile.
5. GST: preset 0-28% templates, auto CGST+SGST vs IGST, GSTR-1-style report, CSV export.
6. Expenses with categories, receipt attachment, approval step.
7. Payroll from salary components (allowances/deductions) and a salary slip.
8. Leave types with balances, approval chain, balance check before approval.
9. Owner dashboard: gross, net, expenses, profit, outstanding, by segment, by payment method; daily/weekly/monthly.
10. P&L and exports (CSV/PDF).
11. Optional: double-entry ledger underneath. Heavy for 24h; a simple transactions + payments table is enough.

## 07 Admin, auth, RBAC, audit, shared services

| Repo | Stars | Stack | Take from it |
|---|---|---|---|
| github.com/directus/directus | ~38.8k | Node, Vue | roles -> policies -> permissions as rows, deny by default, item filters, field allow-lists |
| github.com/stalniy/casl | ~7.1k | TypeScript | can/cannot rules, conditions, serialise rules to frontend |
| github.com/casbin/node-casbin | ~2.9k | TS | policy as data, runtime management API |
| github.com/better-auth/better-auth | ~30k | TypeScript | plugin auth, organisations, 2FA (org/admin plugins to be checked in docs) |
| github.com/novuhq/novu | ~40.3k | TS | notification workflow, channel/provider interface, preferences, in-app inbox |
| github.com/pocketbase/pocketbase | ~61.6k | Go (archived per page) | settings in DB, realtime subscriptions, signed file tokens (design ref only) |
| github.com/refinedev/refine | ~35.6k | React | provider pattern, `can(resource, action)`, audit log entry shape |
| github.com/satnaing/shadcn-admin | ~15.9k | Vite, TanStack Router | fastest good-looking admin shell |
| github.com/spatie/laravel-activitylog | ~5.9k | Laravel | causer + subject + properties, auto-log on model events |
| github.com/spatie/laravel-permission | ~13k | Laravel | DB-stored roles/permissions |
| github.com/jazzband/django-auditlog | n/a | Django | correlation id, field masking, actor snapshot (URL moved; not fetched) |

Best features
1. Roles/permissions as DB rows, deny by default, editable by the owner.
2. Per-resource, per-action permissions with item filters ("own record only").
3. Field-level allow-lists.
4. Serialise rules to the frontend; one `can()` check for menus, buttons, routes.
5. Audit entry: actor, action, resource, record id, previous data, new data, meta JSON, request correlation id.
6. Audit written server-side on every write path, never from the client.
7. Settings table for business rules (discounts, cancellation cut-offs, booking windows, tax) editable in the UI.
8. Notification service: one trigger call, templates, channel adapters, per-user preferences, in-app inbox.
9. Realtime subscriptions with the same permission check.
10. File storage interface (local in dev, S3-compatible later) with short-lived signed URLs.
11. Admin shell from shadcn-admin.
12. Provider-style frontend interfaces so teammates can work in parallel.

---

## Cross-cutting patterns (these should drive the architecture talk)

1. **Ledger over counters**: stock movements, payments, tab entries, audit log are all append-only.
2. **Business rules are data**: plans, discounts, cancellation policy, tax, thresholds live in settings tables.
3. **One pricing engine** (member tier x channel x time band) used by courts, shop, bar, memberships.
4. **DB enforces the hard invariants**: no overlapping bookings (exclusion constraint), no negative stock, no payment above amount due.
5. **Separate state machines** per concept (booking, order, payment, fulfilment, tab, lead, membership).
6. **One notification service and one realtime channel** behind interfaces.
7. **Charged vs paid vs outstanding** modelled once and reused everywhere.

## Honesty notes on the research
- Some repos were confirmed only through search or index pages (Zaryab03/gym_management_pro, southlondonmakerspace/membership-system, UoaWDCC/uabc-web, Invoice Ninja, Firefly III, django-auditlog). Open each link before relying on it.
- Items marked "recalled" or "background knowledge" in the agent reports were not verified in this session.
- Several gym/club repos are tiny coursework-level projects; use them as feature checklists, not code.
- Odoo, TastyIgniter, Bagisto, Snipe-IT, Keycloak, Ory, Supabase, Strapi, Auth.js, AdminJS, react-admin and Socket.IO were not fetched.
