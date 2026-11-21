# DECISIONS

Append-only log of choices not covered by docs/CHAMPIONS_CLUB_ARCHITECTURE.md. Format: date, who, decision, why.

- Initial folder structure created from the architecture file's tree. Package manifests are minimal placeholders; dependencies are added in phase 0.

- 2026-11-21, Dev B: Defined InvoiceService and PaymentService interfaces exactly per section 6 in packages/contract/src/finance.ts (with lineSourceSchema, paymentMethodSchema, and DbTx). This allows Dev A to import type definitions without depending on apps/api/src/modules/invoices or payments internals.
- 2026-11-21, Dev B: Populated packages/contract/src/common.ts with shared money (paiseSchema), pagination (paginationQuerySchema, paginatedResponseSchema), timestamp/date, and standard error types (errorCodeSchema, apiErrorSchema) per section 3.3 so all contract modules share single source of truth schemas.
- 2026-11-21, Dev B: Created UI mock fixtures for shop, bar, finance, and hr in packages/contract/src/fixtures/{shop,bar,finance,hr}.ts to unblock Dev C frontend development.
