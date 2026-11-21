import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_MODULES_ORDER = [
  'core',
  'members',
  'courts',
  'pricing',
  'crm',
  'shop',
  'bar',
  'invoices',
  'hr',
];

export async function runAllSeeds() {
  console.log('[Seed] Starting database seed run...');

  for (const mod of SEED_MODULES_ORDER) {
    const tsFile = path.join(__dirname, `${mod}.ts`);
    const jsFile = path.join(__dirname, `${mod}.js`);
    const filePath = fs.existsSync(tsFile) ? tsFile : fs.existsSync(jsFile) ? jsFile : null;

    if (!filePath) {
      console.log(`[Seed] Skipping missing seed module: ${mod}`);
      continue;
    }

    try {
      console.log(`[Seed] Running seed module: ${mod}...`);
      const imported = await import(pathToFileURL(filePath).href);
      if (typeof imported.seed === 'function') {
        await imported.seed();
      } else if (typeof imported.default === 'function') {
        await imported.default();
      }
    } catch (err) {
      console.error(`[Seed] Error executing seed module ${mod}:`, err);
      throw err;
    }
  }

  console.log('[Seed] All available seed modules executed successfully.');
}

// If executed directly
if (process.argv[1] === __filename) {
  runAllSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Fatal error:', err);
      process.exit(1);
    });
}
