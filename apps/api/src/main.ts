import { buildApp } from './app.js';
import { startJobs } from './core/jobs.js';

const app = buildApp();
const port = Number(process.env.PORT) || 3000;

try {
  if (process.env.NODE_ENV !== 'test') {
    startJobs();
  }
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Champions Club API running on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
