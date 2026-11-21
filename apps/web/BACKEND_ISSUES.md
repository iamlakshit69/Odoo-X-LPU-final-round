# Backend Issues Log (Dev C Frontend Observations)

This log records observed backend behaviors, quirks, and compatibility notes without altering API server code directly.

| Date | Endpoint / Feature | Description | Frontend Handling |
|------|--------------------|-------------|-------------------|
| 2026-11-22 | `/api/events` | SSE connection requires credentials for authenticated stream, but unauthenticated clients should fall back to `/api/public/events` or handle 401 gracefully. | `useSSE` checks auth status and uses authenticated `/api/events` when logged in, or `/api/public/events` when anonymous. |
| 2026-11-22 | `/api/invoices/:id/payments` | Payment recording updates balance view and rejects overpayment with `OVERPAYMENT` error code. | Mapped to toast and handled in payment modal. |
| 2026-11-22 | `/api/pricing/quote` | `at` parameter accepts both ISO date-string and Date object. | Serialized to ISO 8601 string in API client. |
