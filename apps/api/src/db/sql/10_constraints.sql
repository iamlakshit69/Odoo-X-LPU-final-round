CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
      ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
        EXCLUDE USING gist (court_id WITH =, during WITH &&)
        WHERE (status IN ('held','confirmed','completed','no_show'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_end_after_start') THEN
      ALTER TABLE bookings ADD CONSTRAINT bookings_end_after_start CHECK (end_at > start_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_regular_is_60min') THEN
      ALTER TABLE bookings ADD CONSTRAINT bookings_regular_is_60min
        CHECK (kind <> 'regular' OR end_at - start_at = interval '60 minutes');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'bookings_member_day') THEN
      CREATE INDEX bookings_member_day ON bookings (member_id, start_at);
    END IF;
  END IF;
END $$;
