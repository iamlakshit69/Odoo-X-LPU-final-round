import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const databaseUrl =
  process.env.DATABASE_URL || 'postgres://club:club@localhost:5432/champions_club';

describe('SQL Exclusion Constraint & Overlap Invariants (T1/T2)', () => {
  let client: pg.Client;
  let dbAvailable = false;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      dbAvailable = true;
    } catch {
      console.warn('[Test] Postgres not reachable on 5432, skipping live SQL execution test.');
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await client.end();
    }
  });

  it('verifies exclusion constraint logic on overlapping, adjacent, and cancelled bookings', async () => {
    if (!dbAvailable) {
      console.log('Skipping live DB check as Postgres is currently offline.');
      return;
    }

    const courtTypeId = randomUUID();
    const courtId = randomUUID();

    // Setup court type & court
    await client.query(`
      INSERT INTO court_types (id, code, name, base_price_per_hour_paise, tax_category, created_at, updated_at)
      VALUES ($1, $2, 'Test Tennis', 100000, 'court_hire_18', NOW(), NOW())
      ON CONFLICT (code) DO NOTHING
    `, [courtTypeId, `test-tennis-${Date.now()}`]);

    await client.query(`
      INSERT INTO courts (id, court_type_id, name, active, sort_order, created_at, updated_at)
      VALUES ($1, (SELECT id FROM court_types LIMIT 1), 'Test Court 1', true, 1, NOW(), NOW())
    `, [courtId]);

    // 1. Insert confirmed booking [10:00, 11:00)
    const booking1Id = randomUUID();
    await client.query(`
      INSERT INTO bookings (
        id, court_id, kind, status, start_at, end_at, channel, price_paise, created_at, updated_at
      ) VALUES (
        $1, $2, 'regular', 'confirmed',
        '2026-11-21 10:00:00+05:30', '2026-11-21 11:00:00+05:30',
        'counter', 100000, NOW(), NOW()
      )
    `, [booking1Id, courtId]);

    // 2. Overlapping confirmed booking [10:30, 11:30) must fail with code 23P01
    const booking2Id = randomUUID();
    let overlapFailedWith23P01 = false;
    try {
      await client.query(`
        INSERT INTO bookings (
          id, court_id, kind, status, start_at, end_at, channel, price_paise, created_at, updated_at
        ) VALUES (
          $1, $2, 'regular', 'confirmed',
          '2026-11-21 10:30:00+05:30', '2026-11-21 11:30:00+05:30',
          'counter', 100000, NOW(), NOW()
        )
      `, [booking2Id, courtId]);
    } catch (err: any) {
      if (err.code === '23P01') {
        overlapFailedWith23P01 = true;
      }
    }
    expect(overlapFailedWith23P01).toBe(true);

    // 3. Adjacent booking [11:00, 12:00) must succeed (half-open range [) )
    const booking3Id = randomUUID();
    const adjacentRes = await client.query(`
      INSERT INTO bookings (
        id, court_id, kind, status, start_at, end_at, channel, price_paise, created_at, updated_at
      ) VALUES (
        $1, $2, 'regular', 'confirmed',
        '2026-11-21 11:00:00+05:30', '2026-11-21 12:00:00+05:30',
        'counter', 100000, NOW(), NOW()
      ) RETURNING id
    `, [booking3Id, courtId]);
    expect(adjacentRes.rows[0].id).toBe(booking3Id);

    // 4. Cancelled booking overlapping [10:00, 11:00) must succeed
    const booking4Id = randomUUID();
    const cancelledRes = await client.query(`
      INSERT INTO bookings (
        id, court_id, kind, status, start_at, end_at, channel, price_paise, created_at, updated_at
      ) VALUES (
        $1, $2, 'regular', 'cancelled',
        '2026-11-21 10:00:00+05:30', '2026-11-21 11:00:00+05:30',
        'counter', 100000, NOW(), NOW()
      ) RETURNING id
    `, [booking4Id, courtId]);
    expect(cancelledRes.rows[0].id).toBe(booking4Id);
  });
});
