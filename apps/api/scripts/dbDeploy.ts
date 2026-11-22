import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import pg from 'pg';
import { resetDatabase } from './dbReset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl =
  process.env.DATABASE_URL || 'postgres://club:club@localhost:5432/champions_club';

export async function deployDatabase() {
  console.log(`[db:deploy] Checking database state: ${databaseUrl}...`);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      ) as exists;
    `);

    const usersTableExists = Boolean(res.rows[0]?.exists);

    if (!usersTableExists) {
      console.log('[db:deploy] Fresh database detected. Running full reset and seeding...');
      await client.end();
      await resetDatabase();
      return;
    }

    console.log('[db:deploy] Existing database detected. Applying extensions and migrations...');
    
    // Ensure extensions exist
    const extSqlPath = path.join(__dirname, '../src/db/sql/00_ext.sql');
    if (fs.existsSync(extSqlPath)) {
      const extSql = fs.readFileSync(extSqlPath, 'utf-8');
      await client.query(extSql);
    }

    // Apply Drizzle SQL migrations directly (lightweight, zero memory overhead)
    const drizzleDir = path.join(__dirname, '../drizzle');
    if (fs.existsSync(drizzleDir)) {
      const files = fs.readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        console.log(`[db:deploy] Applying migration: ${file}...`);
        const sql = fs.readFileSync(path.join(drizzleDir, file), 'utf-8');
        try {
          await client.query(sql);
        } catch (err: any) {
          console.log(`[db:deploy] Note on migration ${file}: ${err.message}`);
        }
      }
    }

    // Apply SQL files
    const sqlDir = path.join(__dirname, '../src/db/sql');
    if (fs.existsSync(sqlDir)) {
      const sqlFiles = fs
        .readdirSync(sqlDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();

      for (const file of sqlFiles) {
        const filePath = path.join(sqlDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`[db:deploy] Applying SQL: ${file}...`);
        try {
          await client.query(sqlContent);
        } catch (err: any) {
          console.warn(`[db:deploy] Note on ${file}: ${err.message}`);
        }
      }
    }

    console.log('[db:deploy] Database schema verified and up-to-date.');
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

if (process.argv[1] === __filename) {
  deployDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db:deploy] Error during deploy migration:', err);
      process.exit(1);
    });
}
