import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from './core/errors.js';
import { registerAuthRoutes, optionalAuth } from './core/auth.js';
import { register as registerAdmin } from './modules/admin/index.js';
import { registerEventRoutes } from './core/events.js';
import { registerNotificationRoutes } from './core/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findWebDistDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(__dirname, '../../../apps/web/dist'),
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

// Dev A module routers
import { register as registerMembers } from './modules/members/index.js';
import { register as registerCourts } from './modules/courts/index.js';
import { register as registerBookings } from './modules/bookings/index.js';
import { register as registerSocial } from './modules/social/index.js';
import { register as registerPricing } from './modules/pricing/index.js';
import { register as registerCrm } from './modules/crm/index.js';

// Dev B module routers
import { register as registerShop } from './modules/shop/index.js';
import { register as registerInventory } from './modules/inventory/index.js';
import { register as registerBar } from './modules/bar/index.js';
import { register as registerInvoices } from './modules/invoices/index.js';
import { register as registerPayments } from './modules/payments/index.js';
import { register as registerTax } from './modules/tax/index.js';
import { register as registerFinance } from './modules/finance/index.js';
import { register as registerExpenses } from './modules/expenses/index.js';
import { register as registerHr } from './modules/hr/index.js';

export async function registerModules(app: ReturnType<typeof Fastify>) {
  await registerAuthRoutes(app);
  await registerEventRoutes(app);
  await registerNotificationRoutes(app);
  await registerAdmin(app);
  await registerMembers(app);
  await registerCourts(app);
  await registerBookings(app);
  await registerSocial(app);
  await registerPricing(app);
  await registerCrm(app);
  await registerShop(app);
  await registerInventory(app);
  await registerBar(app);
  await registerInvoices(app);
  await registerPayments(app);
  await registerTax(app);
  await registerFinance(app);
  await registerExpenses(app);
  await registerHr(app);
}

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : true,
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cookie, {
    secret: process.env.SESSION_SECRET || 'champions_club_secret_session_key_minimum_32_characters',
  });

  app.addHook('preHandler', optionalAuth);

  app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.setErrorHandler(errorHandler);

  // Health check route
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // Support root-level /events and /public/events as well as /api/events
  registerEventRoutes(app);

  // Register all modules under /api prefix
  app.register(registerModules, { prefix: '/api' });

  // Serve static assets from apps/web/dist if available
  const webDist = findWebDistDir();
  if (webDist) {
    app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      wildcard: false,
    });

    app.setNotFoundHandler(async (req, reply) => {
      const url = req.raw.url || '';
      if (
        url.startsWith('/api') ||
        url.startsWith('/events') ||
        url.startsWith('/public/events') ||
        url.startsWith('/health')
      ) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method}:${url} not found`,
          },
        });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
