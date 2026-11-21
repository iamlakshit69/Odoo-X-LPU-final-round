// Owner: Dev A – Phase 5: Courts + Court Types seed
// DECISION: courts seed created in Phase 5 (courts module not yet fully implemented but seed needed).
// Court type base prices (paise): tennis ₹1500/hr, padel ₹2000/hr, badminton ₹1000/hr, cricket ₹1200/hr
// taxCategory defaults to 'standard' for all court types (GST 18%). Logged in DECISIONS.md.
import { randomUUID } from 'node:crypto';
import { db } from '../../core/db/index.js';
import { courtTypes, courts } from '../schema/courts.js';

export async function seedCourts() {
  const typeRows = [
    { id: randomUUID(), code: 'tennis',    name: 'Tennis Court',    basePricePerHourPaise: 150000, taxCategory: 'standard' },
    { id: randomUUID(), code: 'padel',     name: 'Padel Court',     basePricePerHourPaise: 200000, taxCategory: 'standard' },
    { id: randomUUID(), code: 'badminton', name: 'Badminton Court',  basePricePerHourPaise: 100000, taxCategory: 'standard' },
    { id: randomUUID(), code: 'cricket',   name: 'Cricket Court',    basePricePerHourPaise: 120000, taxCategory: 'standard' },
  ];

  await db.insert(courtTypes).values(typeRows).onConflictDoNothing();

  // 8 courts: 3 tennis, 2 padel, 2 badminton, 1 cricket
  const courtRows = [
    { id: randomUUID(), courtTypeId: typeRows[0].id, name: 'Tennis 1',    active: true },
    { id: randomUUID(), courtTypeId: typeRows[0].id, name: 'Tennis 2',    active: true },
    { id: randomUUID(), courtTypeId: typeRows[0].id, name: 'Tennis 3',    active: true },
    { id: randomUUID(), courtTypeId: typeRows[1].id, name: 'Padel 1',     active: true },
    { id: randomUUID(), courtTypeId: typeRows[1].id, name: 'Padel 2',     active: true },
    { id: randomUUID(), courtTypeId: typeRows[2].id, name: 'Badminton 1', active: true },
    { id: randomUUID(), courtTypeId: typeRows[2].id, name: 'Badminton 2', active: true },
    { id: randomUUID(), courtTypeId: typeRows[3].id, name: 'Cricket 1',   active: true },
  ];

  await db.insert(courts).values(courtRows).onConflictDoNothing();
  console.log('[seed] courts: 4 court types, 8 courts inserted');
}
