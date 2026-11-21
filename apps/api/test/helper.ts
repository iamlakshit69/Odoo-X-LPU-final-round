import pg from 'pg';
import { buildApp } from '../src/app.js';
import { resetDatabase } from '../scripts/dbReset.js';

let _dbAvailable: boolean | null = null;

export async function isDbConnected(): Promise<boolean> {
  if (_dbAvailable !== null) return _dbAvailable;
  const databaseUrl = process.env.DATABASE_URL || 'postgres://club:club@localhost:5432/champions_club';
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.end();
    _dbAvailable = true;
  } catch {
    _dbAvailable = false;
  }
  return _dbAvailable;
}

export function createTestApp() {
  return buildApp();
}

export async function resetTestDb() {
  if (process.env.DATABASE_URL && (await isDbConnected())) {
    await resetDatabase();
  }
}
