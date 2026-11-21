// Owner: Dev A – Phase 6: Courts module router
import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  getPublicAvailabilityQuerySchema,
  getStaffAvailabilityQuerySchema,
  createCourtRequestSchema,
  updateCourtParamsSchema,
  updateCourtRequestSchema,
  updateCourtTypeParamsSchema,
  updateCourtTypeRequestSchema,
} from '@club/contract';
import { Courts, CourtsService } from './service.js';
import { guard } from '../../core/rbac.js';
import { Audit } from '../../core/audit.js';
import { rateLimitMiddleware } from '../../core/rateLimit.js';

export { Courts, CourtsService };

export async function register(app: FastifyInstance) {
  const publicRateLimit = rateLimitMiddleware(20, 60 * 1000);

  // 1. GET /api/public/availability (public, rate-limited)
  const handlePublicAvailability = async (req: FastifyRequest) => {
    const query = getPublicAvailabilityQuerySchema.parse(req.query);
    return Courts.getAvailability(query.date, query.courtType, false);
  };
  app.get('/api/public/availability', { preHandler: [publicRateLimit] }, handlePublicAvailability);
  app.get('/public/availability', { preHandler: [publicRateLimit] }, handlePublicAvailability);

  // 2. GET /api/availability (staff, includes who booked)
  const handleStaffAvailability = async (req: FastifyRequest) => {
    const query = getStaffAvailabilityQuerySchema.parse(req.query);
    return Courts.getAvailability(query.date, query.courtType, true);
  };
  app.get('/api/availability', { preHandler: [guard('booking:read')] }, handleStaffAvailability);
  app.get('/availability', { preHandler: [guard('booking:read')] }, handleStaffAvailability);

  // 3. GET /api/admin/court-types
  const handleListCourtTypes = async () => {
    return Courts.listCourtTypes();
  };
  app.get('/api/admin/court-types', { preHandler: [guard('court:manage')] }, handleListCourtTypes);
  app.get('/admin/court-types', { preHandler: [guard('court:manage')] }, handleListCourtTypes);

  // 4. PUT /api/admin/court-types/:id
  const handleUpdateCourtType = async (req: FastifyRequest) => {
    const { id } = updateCourtTypeParamsSchema.parse(req.params);
    const body = updateCourtTypeRequestSchema.parse(req.body);
    const res = await Courts.updateCourtType(id, body);
    await Audit.log({
      actor: (req as any).user?.id ?? 'system',
      action: 'court_type.update',
      resource: 'court_type',
      recordId: id,
      after: res as any,
    });
    return res;
  };
  app.put('/api/admin/court-types/:id', { preHandler: [guard('court:manage')] }, handleUpdateCourtType);
  app.put('/admin/court-types/:id', { preHandler: [guard('court:manage')] }, handleUpdateCourtType);

  // 5. GET /api/admin/courts
  const handleListCourts = async () => {
    return Courts.listCourts();
  };
  app.get('/api/admin/courts', { preHandler: [guard('court:manage')] }, handleListCourts);
  app.get('/admin/courts', { preHandler: [guard('court:manage')] }, handleListCourts);

  // 6. POST /api/admin/courts
  const handleCreateCourt = async (req: FastifyRequest, reply: any) => {
    const body = createCourtRequestSchema.parse(req.body);
    const res = await Courts.createCourt(body);
    await Audit.log({
      actor: (req as any).user?.id ?? 'system',
      action: 'court.create',
      resource: 'court',
      recordId: res.id,
      after: res as any,
    });
    return reply.status(201).send(res);
  };
  app.post('/api/admin/courts', { preHandler: [guard('court:manage')] }, handleCreateCourt);
  app.post('/admin/courts', { preHandler: [guard('court:manage')] }, handleCreateCourt);

  // 7. PUT /api/admin/courts/:id
  const handleUpdateCourt = async (req: FastifyRequest) => {
    const { id } = updateCourtParamsSchema.parse(req.params);
    const body = updateCourtRequestSchema.parse(req.body);
    const res = await Courts.updateCourt(id, body);
    await Audit.log({
      actor: (req as any).user?.id ?? 'system',
      action: 'court.update',
      resource: 'court',
      recordId: id,
      after: res as any,
    });
    return res;
  };
  app.put('/api/admin/courts/:id', { preHandler: [guard('court:manage')] }, handleUpdateCourt);
  app.put('/admin/courts/:id', { preHandler: [guard('court:manage')] }, handleUpdateCourt);
}
