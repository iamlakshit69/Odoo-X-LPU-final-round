# @club/web — Champions Club Frontend

## Prerequisites

- Node.js 20+
- pnpm 9+
- Running PostgreSQL (see root `README.md`)

## Local Setup

```bash
# From monorepo root
pnpm install

# Start the API (port 3000)
pnpm --filter @club/api dev

# Start the web dev server (port 5173)
pnpm --filter @club/web dev
```

Both servers must run simultaneously. The Vite proxy forwards `/api/**` → `http://localhost:3000`.

## Environment Variables

Create `apps/web/.env.local` (never commit it):

| Variable       | Default                    | Purpose                                               |
|----------------|----------------------------|-------------------------------------------------------|
| `VITE_API_URL` | `http://localhost:3000`    | Base URL for the API (used by the Vite proxy)         |
| `VITE_USE_MSW` | `false`                    | Set `true` to use MSW mocks instead of the real API   |
| `VITE_DEMO`    | `false`                    | Set `true` to show demo quick-login chips on /login   |

Example:
```env
VITE_API_URL=http://localhost:3000
VITE_USE_MSW=false
VITE_DEMO=true
```

## Demo Logins

All accounts use password **`demo1234`**.

| Role        | Email                              | Access                                              |
|-------------|------------------------------------|-----------------------------------------------------|
| Owner       | `owner@championsclub.in`           | All screens, all permissions                        |
| Front Desk  | `frontdesk@championsclub.in`       | Desk, Courts, Members, CRM, Bookings                |
| Shop        | `shop@championsclub.in`            | POS, Orders, Stock                                  |
| Bartender   | `bartender@championsclub.in`       | Bar floor plan, tabs, till                          |
| Kitchen     | `kitchen@championsclub.in`         | KDS kitchen station                                 |
| Cashier     | `cashier@championsclub.in`         | Finance, Invoices, Payments, Expenses               |
| Manager     | `manager@championsclub.in`         | Dashboard, HR, Settings, all commerce               |
| Member      | `member@championsclub.in`          | Member portal (/me/*) only                          |

## Route Map

### Public (unauthenticated)
| Path           | Screen                                                             |
|----------------|--------------------------------------------------------------------|
| `/`            | Public home — hero, sport spotlight, plans carousel, availability, shop catalogue, enquiry form |
| `/login`       | Login form with demo quick-login chips (when `VITE_DEMO=true`)     |

### Member Portal (`/me/*`)
| Path                | Screen                                               |
|---------------------|------------------------------------------------------|
| `/me`               | Portal dashboard — plan overview, upcoming bookings, court booking, shop, invoices, notifications |
| `/me/bookings`      | My bookings with cancel & refund display             |
| `/me/invoices`      | My invoices with print view                          |

### Admin Staff (`/admin/*`)
| Path                      | Screen                                             | Required Permission      |
|---------------------------|----------------------------------------------------|--------------------------|
| `/admin/courts`           | Court availability grid + booking                  | `booking:create`         |
| `/admin/desk`             | Reception omnibox + activity timeline              | `booking:create`         |
| `/admin/members/new`      | Multi-step member enrollment wizard                | `member:create`          |
| `/admin/shop/pos`         | POS — variant picker, cart, tender receipt         | `order:create`           |
| `/admin/shop/orders`      | Order Kanban — live status transitions             | `order:read`             |
| `/admin/shop/stock`       | Stock levels, low-stock alerts, adjust movements   | `stock:read`             |
| `/admin/bar`              | Bar floor plan, tabs, till, Z-report               | `tab:create`             |
| `/admin/kds/:station`     | Kitchen/Bar display system (touch cards)           | `order:read`             |
| `/admin/crm`              | CRM Kanban, lead drawer, quote builder, conversion | `lead:read`              |
| `/admin/dashboard`        | Executive KPI dashboard, charts, live refresh      | `finance:read`           |
| `/admin/finance/invoices` | Invoice list + detail, payment recording, print    | `finance:read`           |
| `/admin/finance/expenses` | Expense log, submit, approve/reject                | `expense:read`           |
| `/admin/hr`               | Staff directory, shift rota, leave requests, payroll, payslips | `hr:read`   |
| `/admin/settings`         | Plans, price rules, cancellation tiers, tax rates, social windows, CRM stages, roles/perms matrix, audit log | `settings:read` |

## Type-check

```bash
pnpm typecheck        # all workspaces
pnpm --filter @club/web typecheck  # web only
```

## Architecture

See [`docs/CHAMPIONS_CLUB_ARCHITECTURE.md`](../../docs/CHAMPIONS_CLUB_ARCHITECTURE.md) and [`DECISIONS.md`](../../DECISIONS.md) in the monorepo root.
