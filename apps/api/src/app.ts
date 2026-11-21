import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import { errorHandler } from './core/errors.js';
import { registerAuthRoutes } from './core/auth.js';
import { register as registerAdmin } from './modules/admin/index.js';

// Dev A module routers
import { register as registerMembers } from './modules/members/index.js';
import { register as registerCourts } from './modules/courts/index.js';
import { register as registerBookings } from './modules/bookings/index.js';
import { register as registerSocial } from './modules/social/index.js';
import { register as registerPricing } from './modules/pricing/index.js';
import { register as registerCrm } from './modules/crm/index.js';

export async function registerModules(app: ReturnType<typeof Fastify>) {
  await registerAuthRoutes(app);
  await registerAdmin(app);
  await registerMembers(app);
  await registerCourts(app);
  await registerBookings(app);
  await registerSocial(app);
  await registerPricing(app);
  await registerCrm(app);
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

  app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.setErrorHandler(errorHandler);

  // Health check route
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // Register all modules under /api prefix
  app.register(registerModules, { prefix: '/api' });

  return app;
}
