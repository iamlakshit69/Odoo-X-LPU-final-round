import { buildApp } from '../src/app.js';
import { resetDatabase } from '../scripts/dbReset.js';

export function createTestApp() {
  return buildApp();
}

export async function resetTestDb() {
  if (process.env.DATABASE_URL) {
    await resetDatabase();
  }
}
