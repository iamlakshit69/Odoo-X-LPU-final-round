import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import pg from 'pg';
import { runAllSeeds } from '../src/db/seed/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl =
  process.env.DATABASE_URL || 'postgres://club:club@localhost:5432/champions_club';

export async function resetDatabase() {
  console.log(`[db:reset] Connecting to database: ${databaseUrl}...`);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // 1. Drop and recreate the public schema
    console.log('[db:reset] Dropping and recreating public schema...');
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'club') THEN
          GRANT ALL ON SCHEMA public TO club;
        END IF;
      END $$;
    `);
    console.log('[db:reset] Schema public recreated.');

    // 1b. Apply 00_ext.sql before push to ensure required extensions exist
    const extSqlPath = path.join(__dirname, '../src/db/sql/00_ext.sql');
    if (fs.existsSync(extSqlPath)) {
      console.log('[db:reset] Applying extensions from 00_ext.sql...');
      const extSql = fs.readFileSync(extSqlPath, 'utf-8');
      await client.query(extSql);
    }

    // 2. Run drizzle-kit push
    console.log('[db:reset] Running drizzle-kit push...');
    const apiRoot = path.join(__dirname, '..');
    execSync('npx tsx ./node_modules/drizzle-kit/bin.cjs push --force --config=drizzle.config.ts', {
      cwd: apiRoot,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log('[db:reset] Drizzle push complete.');

    // 3. Apply db/sql/*.sql in filename order
    const sqlDir = path.join(__dirname, '../src/db/sql');
    if (fs.existsSync(sqlDir)) {
      const sqlFiles = fs
        .readdirSync(sqlDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();

      for (const file of sqlFiles) {
        const filePath = path.join(sqlDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`[db:reset] Applying SQL: ${file}...`);
        await client.query(sqlContent);
      }
    }

    // 4. Run seeds
    console.log('[db:reset] Running seeds...');
    await runAllSeeds();

    console.log('[db:reset] Database reset and seeded successfully.');
  } finally {
    await client.end();
  }
}

if (process.argv[1] === __filename) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db:reset] Error during db reset:', err);
      process.exit(1);
    });
}
