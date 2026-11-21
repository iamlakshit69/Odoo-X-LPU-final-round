# DECISIONS

Append-only log of choices not covered by docs/CHAMPIONS_CLUB_ARCHITECTURE.md. Format: date, who, decision, why.

- Initial folder structure created from the architecture file's tree. Package manifests are minimal placeholders; dependencies are added in phase 0.

- 2026-11-21, Dev B: Defined InvoiceService and PaymentService interfaces exactly per section 6 in packages/contract/src/finance.ts (with lineSourceSchema, paymentMethodSchema, and DbTx). This allows Dev A to import type definitions without depending on apps/api/src/modules/invoices or payments internals.
- 2026-11-21, Dev B: Populated packages/contract/src/common.ts with shared money (paiseSchema), pagination (paginationQuerySchema, paginatedResponseSchema), timestamp/date, and standard error types (errorCodeSchema, apiErrorSchema) per section 3.3 so all contract modules share single source of truth schemas.
- 2026-11-21, Dev B: Created UI mock fixtures for shop, bar, finance, and hr in packages/contract/src/fixtures/{shop,bar,finance,hr}.ts to unblock Dev C frontend development.
- 2026-11-21, Dev A: Scaffolded monorepo with pnpm workspaces, root configs, fastify, drizzle-orm, and contract re-exports. Added clubTime helpers, custom AppError, db:reset script, and health check endpoint per Phase 0 specifications.
- 2026-11-21, Dev A: Defined complete Zod schemas and TypeScript models for sections 7.1 to 7.5 (auth, admin, members, courts, bookings, pricing, crm) and Section 6 service interfaces (PricingEngine, Notifications, Events, Audit, Can, Settings) in packages/contract/src. Added complete mock fixtures with realistic INR paise and IST timestamps in fixtures/{auth,admin,members,courts,bookings,pricing,crm}.ts to unblock Dev C.
- 2026-11-21, Dev A: Modeled court availability with strict schema separation between publicSlotSchema (no personal identifiable data) and staffSlotSchema (includes bookedBy member/guest details) per security and privacy requirements in Section 7.3.
