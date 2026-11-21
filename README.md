# Champions Club

Sports club management system backend and application suite.

Source of truth: `docs/CHAMPIONS_CLUB_ARCHITECTURE.md`.

---

## 🚀 Live Demo & Deployment

- **Live URL**: [https://07adad5ee995ac.app.lhr.life](https://07adad5ee995ac.app.lhr.life)
- **All Demo Accounts Password**: `demo1234`

### Demo Credentials by Role

| Role | Email | Password | Landing Page |
|---|---|---|---|
| **Owner** | `owner@championsclub.in` | `demo1234` | `/admin/courts` |
| **Manager** | `manager@championsclub.in` | `demo1234` | `/admin/courts` |
| **Front Desk** | `frontdesk@championsclub.in` | `demo1234` | `/admin/frontdesk` |
| **Shop Clerk** | `shop@championsclub.in` | `demo1234` | `/admin/shop` |
| **Bartender** | `bartender@championsclub.in` | `demo1234` | `/admin/bar` |
| **Kitchen** | `kitchen@championsclub.in` | `demo1234` | `/admin/kitchen` |
| **Cashier** | `cashier@championsclub.in` | `demo1234` | `/admin/invoices` |
| **Finance** | `finance@championsclub.in` | `demo1234` | `/admin/finance` |
| **HR** | `hr@championsclub.in` | `demo1234` | `/admin/hr` |
| **Member** | `member@championsclub.in` | `demo1234` | `/portal` |

---

## Architecture & Ownership

| Area / Modules | Owner | Responsibilities |
|---|---|---|
| `apps/api/src/core/**`<br>`modules/{members,courts,bookings,social,pricing,crm}`<br>`db/schema/{core,members,courts,pricing,crm}.ts`<br>`db/seed/{core,members,courts,pricing,crm}.ts` | **Dev A** | Core Auth & Sessions, RBAC `:own` engine, Settings, Audit ledger, Realtime SSE events, Notifications & Jobs, Memberships & Lifecycle, Court Types & Courts, Transactional Booking Engine, Social Play & Waitlists, Specificity Pricing Engine, CRM & Lead pipeline |
| `apps/api/src/modules/{shop,inventory,bar,invoices,payments,tax,finance,expenses,hr}`<br>`db/schema/{shop,bar,invoices,hr}.ts`<br>`db/seed/{shop,bar,invoices,hr}.ts` | **Dev B** | Invoices & Payments ledger, Shop POS & Inventory, Bar Tabs & KDS, Financial accounts & GST, HR & Payroll |
| `apps/web/**` | **Dev C** | Vite + React frontend, shadcn UI components, PermissionGate, MSW mock suite & live API client |
| `packages/contract/**` | Shared | TypeScript Zod contract schemas and mock fixtures for all endpoints |

---

## Getting Started

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose (for PostgreSQL 16)

### Installation & Run

1. **Clone the repository and copy environment**:
   ```bash
   git clone https://github.com/iamlakshit69/Odoo-X-LPU-final-round.git
   cd Odoo-X-LPU-final-round
   cp .env.example .env
   ```

2. **Start PostgreSQL database**:
   ```bash
   docker compose up -d db
   ```

3. **Install dependencies**:
   ```bash
   pnpm install
   ```

4. **Reset and Seed Database**:
   ```bash
   pnpm db:reset
   ```
   This executes database migrations, extensions (`btree_gist`), sequences (`member_code_seq`), and seeds all initial data:
   - 10 system roles with granular permission mappings
   - 10 demo users (one per role, password `demo1234`)
   - 4 court types (Tennis, Padel, Badminton, Cricket nets) and 8 courts
   - Section 7.4 seed pricing rules (Gold free, Silver peak 40% off, Silver off-peak 60% off, Junior before 17:00 70% off)
   - 3 membership plans (Gold, Silver, Junior) and 40 seeded members
   - Tonight's busy court schedule (6 to 9 pm with exactly 3 open slots)
   - Friday Social Mixer session (14/16 confirmed, 2 on waitlist)
   - 6 CRM leads across pipeline stages, open/overdue tasks, and draft quotes

5. **Start Development Servers**:
   ```bash
   pnpm dev
   ```
   - API: http://localhost:3000
   - Web: http://localhost:5173

---

## Demo Accounts (Password: `demo1234`)

All demo accounts use password `demo1234`:

| Role | Email | Name | Key Capabilities |
|---|---|---|---|
| **Owner** | `owner@championsclub.in` | Rajesh Khanna | Full unrestricted access to all modules, financial metrics, and settings |
| **Manager** | `manager@championsclub.in` | Deepak Verma | Operational oversight, staff management, schedule adjustments |
| **Front Desk** | `frontdesk@championsclub.in` | Sunita Rao | Member registrations, check-ins, court bookings, lead management |
| **Shop Clerk** | `shop@championsclub.in` | Manoj Kumar | Pro-shop POS counter, stock inventory adjustments |
| **Bartender** | `bartender@championsclub.in` | Ajay Singh | Bar tabs, beverage orders, till sessions |
| **Kitchen** | `kitchen@championsclub.in` | Chef Sanjeev | Kitchen Display System (KDS) order statuses |
| **Cashier** | `cashier@championsclub.in` | Pooja Sharma | Payments, tab settlements, till operations |
| **Finance** | `finance@championsclub.in` | Sanjay Gupta | Financial reports, invoice ledger, aging balances, tax summaries |
| **HR** | `hr@championsclub.in` | Ritu Kapoor | Employee profiles, leave approvals, payroll runs |
| **Member** | `member@championsclub.in` | Aarav Sharma | Self-service member portal (own profile, own bookings, social play) |

---

## Testing & Quality Assurance

Run typecheck across all workspaces:
```bash
pnpm typecheck
```

Run the complete Vitest test suite:
```bash
pnpm test
```

Test coverage includes:
- `bookingConstraint.test.ts`: PostgreSQL `btree_gist` exclusion constraint guarantees (T1/T2)
- `bookings.test.ts`: 7-step transactional booking algorithm, 20 parallel requests for 1 slot, daily booking limits, cancellation refunds (T1, T2, T3, T4, T6)
- `pricing.test.ts`: 26 pricing specificity rules, tier discounts, day/time bands, tie-breakers (T5)
- `social.test.ts`: Social session creation, waitlist promotion on cancellation, non-member rejection (T7)
- `authRbac.test.ts`: Session cookies, deny-by-default RBAC, `:own` scoped access, audit logging (T13, T14)
- `crm.test.ts`: Lead enquiry, rate-limiting, pipeline stages, quote calculation, atomic conversion
- `hardening.test.ts`: Full RBAC matrix, PII protection on public endpoints, zero contract fixture drift
- `demoScenes.test.ts`: Automated walk-through of Scenes 1, 2, 5, 7 from Section 14.3
