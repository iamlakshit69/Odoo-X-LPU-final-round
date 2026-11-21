-- Constraints, Indexes and Ledger Triggers for Core & Booking tables
-- Idempotent script executed after schema push

-- 1. Ensure during generated column on bookings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'during'
    ) THEN
      ALTER TABLE bookings ADD COLUMN during tstzrange 
        GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED;
    END IF;
  END IF;
END $$;

-- 2. Exclusion constraint preventing overlapping active bookings on the same court
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
      ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
        EXCLUDE USING gist (court_id WITH =, during WITH &&)
        WHERE (status IN ('held','confirmed','completed','no_show'));
    END IF;
  END IF;
END $$;

-- 3. CHECK end_at > start_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_end_after_start') THEN
      ALTER TABLE bookings ADD CONSTRAINT bookings_end_after_start CHECK (end_at > start_at);
    END IF;
  END IF;
END $$;

-- 4. CHECK regular booking is 60 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_regular_is_60min') THEN
      ALTER TABLE bookings ADD CONSTRAINT bookings_regular_is_60min
        CHECK (kind <> 'regular' OR end_at - start_at = interval '60 minutes');
    END IF;
  END IF;
END $$;

-- 5. Index for member day bookings count
CREATE INDEX IF NOT EXISTS bookings_member_day ON bookings (member_id, start_at);

-- 6. Append-only ledger triggers (Section 4 Rule 2)

-- Function: reject update and delete
CREATE OR REPLACE FUNCTION prevent_update_or_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table % is an append-only ledger; updates and deletes are forbidden.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Apply to audit_log
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
    DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
    CREATE TRIGGER trg_audit_log_append_only
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_update_or_delete();
  END IF;
END $$;

-- Apply to checkins
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checkins') THEN
    DROP TRIGGER IF EXISTS trg_checkins_append_only ON checkins;
    CREATE TRIGGER trg_checkins_append_only
    BEFORE UPDATE OR DELETE ON checkins
    FOR EACH ROW EXECUTE FUNCTION prevent_update_or_delete();
  END IF;
END $$;

-- Function: notifications allows updating status and read_at only; rejects delete
CREATE OR REPLACE FUNCTION prevent_notifications_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Table notifications is an append-only ledger; deletes are forbidden.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.id <> NEW.id OR
       OLD.user_id IS DISTINCT FROM NEW.user_id OR
       OLD.member_id IS DISTINCT FROM NEW.member_id OR
       OLD.lead_id IS DISTINCT FROM NEW.lead_id OR
       OLD.channel <> NEW.channel OR
       OLD.template <> NEW.template OR
       OLD.payload IS DISTINCT FROM NEW.payload OR
       OLD.created_at <> NEW.created_at THEN
      RAISE EXCEPTION 'Table notifications only allows updating status and read_at.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    DROP TRIGGER IF EXISTS trg_notifications_mutation ON notifications;
    CREATE TRIGGER trg_notifications_mutation
    BEFORE UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION prevent_notifications_mutation();
  END IF;
END $$;
