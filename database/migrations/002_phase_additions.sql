-- Phase 5: temporary booking holds (status 'pending' + hold_expires_at; a job cancels expired holds)
ALTER TABLE bookings ADD COLUMN hold_expires_at timestamptz;

-- Phase 8: attendance
CREATE TABLE attendance (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES employees(id),
  work_date   date NOT NULL DEFAULT current_date,
  check_in    timestamptz,
  check_out   timestamptz,
  status      text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','half_day','leave')),
  UNIQUE (employee_id, work_date)
);

-- Phase 9: quotes
CREATE TABLE quotes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id     bigint NOT NULL REFERENCES leads(id),
  plan_id     bigint NOT NULL REFERENCES membership_plans(id),
  amount      numeric(12,2) NOT NULL,
  valid_until date,
  status      text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','accepted','rejected','expired')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Phase 11: tournaments + QR check-in
CREATE TABLE tournaments (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             text NOT NULL,
  sport            text NOT NULL,
  starts_on        date NOT NULL,
  ends_on          date,
  entry_fee        numeric(12,2) NOT NULL DEFAULT 0,
  max_participants int NOT NULL,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','ongoing','completed','cancelled'))
);
CREATE TABLE tournament_registrations (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id bigint NOT NULL REFERENCES tournaments(id),
  member_id     bigint NOT NULL REFERENCES members(id),
  paid          boolean NOT NULL DEFAULT false,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, member_id)
);
ALTER TABLE members ADD COLUMN qr_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
CREATE TABLE member_checkins (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id     bigint NOT NULL REFERENCES members(id),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_in_by bigint REFERENCES users(id)
);
