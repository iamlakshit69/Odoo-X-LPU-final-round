// Owner: Dev A – Phase 8: CRM module router
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createPublicEnquiryRequestSchema,
  createPublicTrialBookingRequestSchema,
  getLeadsQuerySchema,
  getLeadParamsSchema,
  updateLeadParamsSchema,
  updateLeadRequestSchema,
  createLeadNoteParamsSchema,
  createLeadNoteRequestSchema,
  createLeadTaskParamsSchema,
  createLeadTaskRequestSchema,
  updateLeadTaskParamsSchema,
  updateLeadTaskRequestSchema,
  createLeadQuoteParamsSchema,
  createLeadQuoteRequestSchema,
  sendQuoteParamsSchema,
  convertLeadParamsSchema,
  convertLeadRequestSchema,
  SessionUser,
} from '@club/contract';
import { Crm, CrmService } from './service.js';
import { guard } from '../../core/rbac.js';
import { AppError } from '../../core/errors.js';
import { rateLimitMiddleware } from '../../core/rateLimit.js';

export { Crm, CrmService };

export async function register(app: FastifyInstance) {
  const publicRateLimit = rateLimitMiddleware(10, 60 * 1000);

  // 1. POST /api/public/enquiries
  const handlePublicEnquiry = async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createPublicEnquiryRequestSchema.parse(req.body);
    const res = await Crm.createEnquiry(body);
    return reply.status(201).send(res);
  };
  app.post('/public/enquiries', { preHandler: [publicRateLimit] }, handlePublicEnquiry);

  // 2. POST /api/public/trial-bookings
  const handlePublicTrialBooking = async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createPublicTrialBookingRequestSchema.parse(req.body);
    const res = await Crm.createTrialBooking(body);
    return reply.status(201).send(res);
  };
  app.post('/public/trial-bookings', { preHandler: [publicRateLimit] }, handlePublicTrialBooking);

  // 3. GET /api/leads
  const handleListLeads = async (req: FastifyRequest) => {
    const query = getLeadsQuerySchema.parse(req.query);
    return Crm.listLeads({
      stage: query.stage,
      assignedTo: query.assignedTo,
      source: query.source,
      cursor: query.cursor,
      limit: query.limit,
    });
  };
  app.get('/leads', { preHandler: [guard('lead:read')] }, handleListLeads);

  // 4. GET /api/leads/:id
  const handleGetLead = async (req: FastifyRequest) => {
    const { id } = getLeadParamsSchema.parse(req.params);
    return Crm.getLead(id);
  };
  app.get('/leads/:id', { preHandler: [guard('lead:read')] }, handleGetLead);

  // 5. PATCH /api/leads/:id
  const handleUpdateLead = async (req: FastifyRequest) => {
    const { id } = updateLeadParamsSchema.parse(req.params);
    const body = updateLeadRequestSchema.parse(req.body);
    const user = (req as any).user as SessionUser | undefined;
    return Crm.updateLead(id, body, user?.id);
  };
  app.patch('/leads/:id', { preHandler: [guard('lead:update')] }, handleUpdateLead);

  // 6. POST /api/leads/:id/notes
  const handleCreateNote = async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = createLeadNoteParamsSchema.parse(req.params);
    const body = createLeadNoteRequestSchema.parse(req.body);
    const user = (req as any).user as SessionUser | undefined;
    const res = await Crm.addNote(id, body.body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/leads/:id/notes', { preHandler: [guard('lead:update')] }, handleCreateNote);

  // 7. POST /api/leads/:id/tasks
  const handleCreateTask = async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = createLeadTaskParamsSchema.parse(req.params);
    const body = createLeadTaskRequestSchema.parse(req.body);
    const user = (req as any).user as SessionUser | undefined;
    const res = await Crm.addTask(id, body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/leads/:id/tasks', { preHandler: [guard('lead:update')] }, handleCreateTask);

  // 8. PATCH /api/tasks/:id
  const handleUpdateTask = async (req: FastifyRequest) => {
    const { id } = updateLeadTaskParamsSchema.parse(req.params);
    const body = updateLeadTaskRequestSchema.parse(req.body);
    const user = (req as any).user as SessionUser | undefined;
    return Crm.updateTask(id, body, user?.id);
  };
  app.patch('/tasks/:id', { preHandler: [guard('lead:update')] }, handleUpdateTask);

  // 9. POST /api/leads/:id/quotes
  const handleCreateQuote = async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = createLeadQuoteParamsSchema.parse(req.params);
    const body = createLeadQuoteRequestSchema.parse(req.body);
    const user = (req as any).user as SessionUser | undefined;
    const res = await Crm.createQuote(id, body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/leads/:id/quotes', { preHandler: [guard('quote:manage')] }, handleCreateQuote);

  // 10. POST /api/quotes/:id/send
  const handleSendQuote = async (req: FastifyRequest) => {
    const { id } = sendQuoteParamsSchema.parse(req.params);
    const user = (req as any).user as SessionUser | undefined;
    return Crm.sendQuote(id, user?.id);
  };
  app.post('/quotes/:id/send', { preHandler: [guard('quote:manage')] }, handleSendQuote);

  // 11. POST /api/leads/:id/convert
  const handleConvertLead = async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = convertLeadParamsSchema.parse(req.params);
    const body = convertLeadRequestSchema.parse(req.body);
    const user = (req as any).user as SessionUser | undefined;
    const res = await Crm.convertLead(id, body, user?.id);
    return reply.status(200).send(res);
  };
  app.post('/leads/:id/convert', { preHandler: [guard('lead:convert')] }, handleConvertLead);
}
