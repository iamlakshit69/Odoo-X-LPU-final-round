import pg from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { DbTx } from '@club/contract';

const { Pool } = pg;

export type { DbTx };

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://club:club@localhost:5432/champions_club',
});

export const db = drizzle(pool);
export type Database = NodePgDatabase;
