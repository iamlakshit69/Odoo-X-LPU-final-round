-- Champions Club Management Platform: RAW schema v0.1 (PostgreSQL 15+)
-- Draft for discussion. Agree on this with the team BEFORE writing module code.
-- Conventions: bigint identity PKs, numeric(12,2) for money, timestamptz for time,
-- snake_case, soft-deactivate via is_active/status instead of DELETE.

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- needed for booking overlap constraint
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ 07 ADMIN / AUTH ============
CREATE TABLE roles (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name      text UNIQUE NOT NULL,            -- owner, manager, front_desk, shop, bar, kitchen, member
  permissions jsonb NOT NULL DEFAULT '{}'    -- e.g. {"bookings":"manage","finance":"view"}
);

CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id       bigint NOT NULL REFERENCES roles(id),
  email         text UNIQUE NOT NULL,
  phone         text,
  password_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint UNIQUE REFERENCES users(id),
  full_name    text NOT NULL,
  department   text NOT NULL,                -- front_desk, shop, bar, kitchen, admin
  designation  text,
  base_salary  numeric(12,2) NOT NULL DEFAULT 0,
  joining_date date NOT NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','terminated'))
);

CREATE TABLE settings (                      -- configurable business rules (no hardcoding)
  key        text PRIMARY KEY,               -- e.g. booking.max_daily_sessions, tax.gst_pct
  value      jsonb NOT NULL,
  updated_by bigint REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint REFERENCES users(id),
  action      text NOT NULL,                 -- 'booking.cancel', 'plan.update'
  entity_type text NOT NULL,
  entity_id   bigint,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint REFERENCES users(id),    -- internal recipient (nullable)
  member_id  bigint,                         -- FK added after members table
  channel    text NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp')),
  type       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}',
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','read')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 01 MEMBERSHIP ============
CREATE TABLE membership_plans (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                 text UNIQUE NOT NULL,   -- Gold, Silver, Junior
  price                numeric(12,2) NOT NULL,
  duration_days        int NOT NULL,
  court_discount_pct   numeric(5,2) NOT NULL DEFAULT 0,
  shop_discount_pct    numeric(5,2) NOT NULL DEFAULT 0,
  bar_discount_pct     numeric(5,2) NOT NULL DEFAULT 0,
  max_daily_bookings   int NOT NULL DEFAULT 2,
  privileges           jsonb NOT NULL DEFAULT '{}',
  is_active            boolean NOT NULL DEFAULT true
);

CREATE TABLE members (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_code text UNIQUE NOT NULL,          -- human-friendly ID e.g. CC-00042
  user_id     bigint UNIQUE REFERENCES users(id),  -- for member portal login
  full_name   text NOT NULL,
  phone       text UNIQUE NOT NULL,          -- duplicate prevention
  email       text UNIQUE,
  dob         date,
  address     text,
  photo_url   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ADD FOREIGN KEY (member_id) REFERENCES members(id);

CREATE TABLE memberships (                   -- history: one row per subscription period
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id     bigint NOT NULL REFERENCES members(id),
  plan_id       bigint NOT NULL REFERENCES membership_plans(id),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','suspended','cancelled','upgraded')),
  previous_membership_id bigint REFERENCES memberships(id),  -- upgrade/renewal chain
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON memberships(member_id, status);
CREATE INDEX ON memberships(end_date);       -- expiry reminder job

-- ============ SHARED: PAYMENTS ============
CREATE TABLE payments (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ref_type    text NOT NULL CHECK (ref_type IN ('membership','booking','shop_order','pos_order','tab','invoice','social_event')),
  ref_id      bigint NOT NULL,
  member_id   bigint REFERENCES members(id),
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  method      text NOT NULL CHECK (method IN ('cash','card','upi','online')),
  status      text NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed','refunded')),
  gateway_ref text,
  received_by bigint REFERENCES users(id),
  paid_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON payments(ref_type, ref_id);

-- ============ 02 COURT BOOKING ============
CREATE TABLE courts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL,
  sport        text NOT NULL,
  location     text,
  opens_at     time NOT NULL,
  closes_at    time NOT NULL,
  hourly_rate  numeric(12,2) NOT NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','unavailable'))
);

CREATE TABLE court_blocks (                  -- maintenance windows
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  court_id  bigint NOT NULL REFERENCES courts(id),
  starts_at timestamptz NOT NULL,
  ends_at   timestamptz NOT NULL,
  reason    text
);

CREATE TABLE bookings (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  court_id       bigint NOT NULL REFERENCES courts(id),
  member_id      bigint REFERENCES members(id),        -- null for walk-in
  guest_name     text,
  guest_phone    text,
  start_time     timestamptz NOT NULL,
  end_time       timestamptz NOT NULL,
  booking_type   text NOT NULL DEFAULT 'regular' CHECK (booking_type IN ('regular','walk_in','trial','social_play')),
  status         text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  base_amount    numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount   numeric(12,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  source         text NOT NULL DEFAULT 'front_desk' CHECK (source IN ('website','front_desk','walk_in')),
  created_by     bigint REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  -- DB-LEVEL conflict prevention: two overlapping active bookings on one court are impossible
  EXCLUDE USING gist (court_id WITH =, tstzrange(start_time, end_time) WITH &&)
    WHERE (status IN ('pending','confirmed'))
);
CREATE INDEX ON bookings(member_id, start_time);

CREATE TABLE social_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id  bigint UNIQUE NOT NULL REFERENCES bookings(id),  -- occupies the court
  title       text NOT NULL,
  capacity    int NOT NULL,
  fee_per_person numeric(12,2) NOT NULL DEFAULT 0
);
CREATE TABLE social_event_participants (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id  bigint NOT NULL REFERENCES social_events(id),
  member_id bigint REFERENCES members(id),
  guest_name text,
  paid      boolean NOT NULL DEFAULT false
);

-- ============ 03 SHOP & INVENTORY ============
CREATE TABLE suppliers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL, phone text, email text, address text
);

CREATE TABLE products (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku         text UNIQUE NOT NULL,
  name        text NOT NULL,
  category    text NOT NULL,                  -- rackets, balls, shoes, accessories, apparel
  brand       text,
  description text,
  price       numeric(12,2) NOT NULL,
  cost_price  numeric(12,2),
  image_url   text,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE inventory (
  product_id bigint PRIMARY KEY REFERENCES products(id),
  quantity   int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock  int NOT NULL DEFAULT 0
);

CREATE TABLE stock_movements (               -- LEDGER: never edit quantity without a row here
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products(id),
  change     int NOT NULL,                    -- +10 received, -2 sold
  reason     text NOT NULL CHECK (reason IN ('initial','purchase','counter_sale','online_sale','return','damage','adjustment')),
  ref_type   text, ref_id bigint,
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchase_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id bigint NOT NULL REFERENCES suppliers(id),
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','received','cancelled')),
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE purchase_order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_order_id bigint NOT NULL REFERENCES purchase_orders(id),
  product_id bigint NOT NULL REFERENCES products(id),
  quantity int NOT NULL, unit_cost numeric(12,2) NOT NULL
);

CREATE TABLE shop_orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id   bigint REFERENCES members(id),
  channel     text NOT NULL CHECK (channel IN ('online','counter')),
  fulfilment  text NOT NULL DEFAULT 'pickup' CHECK (fulfilment IN ('pickup','delivery')),
  delivery_address text,
  status      text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','paid','processing','ready','dispatched','completed','cancelled','refunded')),
  subtotal    numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount  numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'unpaid',
  created_by  bigint REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shop_order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES shop_orders(id),
  product_id bigint NOT NULL REFERENCES products(id),
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL            -- snapshot price at time of sale
);

-- ============ 04 BAR & CAFETERIA POS ============
CREATE TABLE menu_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL, description text,
  category text NOT NULL,                      -- starters, main, snacks, soft_drinks, hot_beverages
  price numeric(12,2) NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  image_url text
);

CREATE TABLE cafe_tables (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text UNIQUE NOT NULL,                  -- T01
  seats int,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved'))
);

CREATE TABLE shifts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES employees(id),
  starts_at timestamptz NOT NULL,
  ended_at timestamptz,
  opening_cash numeric(12,2) DEFAULT 0,
  closing_cash numeric(12,2)
);

CREATE TABLE tabs (                            -- running customer balance
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id bigint REFERENCES members(id),
  table_id bigint REFERENCES cafe_tables(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE pos_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_id bigint REFERENCES cafe_tables(id),
  tab_id bigint REFERENCES tabs(id),
  member_id bigint REFERENCES members(id),
  employee_id bigint REFERENCES employees(id),
  shift_id bigint REFERENCES shifts(id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','preparing','ready','served','cancelled')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pos_order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES pos_orders(id),
  menu_item_id bigint NOT NULL REFERENCES menu_items(id),
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  notes text
);

-- ============ 05 WEBSITE & CRM ============
CREATE TABLE leads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL, phone text NOT NULL, email text,
  interested_plan_id bigint REFERENCES membership_plans(id),
  sport text,
  source text NOT NULL CHECK (source IN ('website','phone','walk_in','other')),
  assigned_to bigint REFERENCES employees(id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quotation_sent','follow_up','converted','lost')),
  converted_member_id bigint REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lead_activities (                 -- notes, calls, follow-ups
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id bigint NOT NULL REFERENCES leads(id),
  note text NOT NULL,
  follow_up_at timestamptz,
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE trial_bookings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id bigint REFERENCES leads(id),
  booking_id bigint REFERENCES bookings(id),
  visitor_name text NOT NULL, phone text NOT NULL,
  sport text, preferred_date date, preferred_time time, requirements text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','completed','cancelled'))
);

-- ============ 06 FINANCE & HR ============
CREATE TABLE invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_no text UNIQUE NOT NULL,
  invoice_type text NOT NULL CHECK (invoice_type IN ('membership','booking','shop','cafeteria','corporate')),
  member_id bigint REFERENCES members(id),
  client_name text,                            -- corporate clients
  ref_type text, ref_id bigint,
  subtotal numeric(12,2) NOT NULL, discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0, total_amount numeric(12,2) NOT NULL,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,   -- outstanding = total - paid
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','overdue','void')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invoice_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id bigint NOT NULL REFERENCES invoices(id),
  description text NOT NULL, quantity int NOT NULL DEFAULT 1, unit_price numeric(12,2) NOT NULL
);

CREATE TABLE expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category text NOT NULL,                      -- salaries, equipment, maintenance, utilities, rent, marketing...
  description text, amount numeric(12,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'paid',
  receipt_url text, expense_date date NOT NULL DEFAULT current_date,
  created_by bigint REFERENCES users(id)
);

CREATE TABLE payroll (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES employees(id),
  period_month date NOT NULL,                  -- first day of month
  base_salary numeric(12,2) NOT NULL,
  allowances numeric(12,2) NOT NULL DEFAULT 0,
  deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_pay numeric(12,2) NOT NULL,
  paid_at timestamptz,
  UNIQUE (employee_id, period_month)
);

CREATE TABLE leave_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES employees(id),
  from_date date NOT NULL, to_date date NOT NULL, reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by bigint REFERENCES users(id), decided_at timestamptz
);

-- ============ SEED (minimal) ============
INSERT INTO roles(name) VALUES ('owner'),('manager'),('front_desk'),('shop'),('bar'),('kitchen'),('member');
INSERT INTO membership_plans(name, price, duration_days, court_discount_pct, shop_discount_pct, bar_discount_pct, max_daily_bookings)
VALUES ('Gold', 12000, 365, 100, 15, 15, 2), ('Silver', 6000, 365, 10, 10, 10, 2), ('Junior', 3000, 365, 20, 5, 5, 2);
-- ^ demo numbers only; real values come from the owner via settings/plan management
