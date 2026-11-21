// Owner: Dev B – Finance Module Router (Section 7.8)
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createBusinessClientRequestSchema,
  updateBusinessClientParamsSchema,
  updateBusinessClientRequestSchema,
  getFinanceSummaryQuerySchema,
  getFinanceExportQuerySchema,
  shareFinanceRequestSchema,
  SessionUser,
} from '@club/contract';
import { Finance, FinanceService } from './service.js';
import { guard } from '../../core/rbac.js';

export { Finance, FinanceService };

export async function register(app: FastifyInstance) {
  // 1. Business Clients CRUD
  const handleGetClients = async () => Finance.getBusinessClients();
  app.get('/business-clients', { preHandler: [guard('client:manage')] }, handleGetClients);

  const handleCreateClient = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createBusinessClientRequestSchema.parse(req.body);
    const res = await Finance.createBusinessClient(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/business-clients', { preHandler: [guard('client:manage')] }, handleCreateClient);

  const handleGetClient = async (req: FastifyRequest) => {
    const { id } = updateBusinessClientParamsSchema.parse(req.params);
    return Finance.getBusinessClient(id);
  };
  app.get('/business-clients/:id', { preHandler: [guard('client:manage')] }, handleGetClient);

  const handleUpdateClient = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateBusinessClientParamsSchema.parse(req.params);
    const body = updateBusinessClientRequestSchema.parse(req.body);
    return Finance.updateBusinessClient(id, body, user?.id);
  };
  app.patch('/business-clients/:id', { preHandler: [guard('client:manage')] }, handleUpdateClient);

  const handleDeleteClient = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateBusinessClientParamsSchema.parse(req.params);
    return Finance.deleteBusinessClient(id, user?.id);
  };
  app.delete('/business-clients/:id', { preHandler: [guard('client:manage')] }, handleDeleteClient);

  // 2. Finance Summary
  const handleGetSummary = async (req: FastifyRequest) => {
    const query = getFinanceSummaryQuerySchema.parse(req.query);
    return Finance.getSummary(query);
  };
  app.get('/finance/summary', { preHandler: [guard('finance:read')] }, handleGetSummary);

  // 3. Receivables & Aging Buckets
  const handleGetReceivables = async () => Finance.getReceivables();
  app.get('/finance/receivables', { preHandler: [guard('finance:read')] }, handleGetReceivables);

  // 4. CSV Export
  const handleGetExport = async (req: FastifyRequest, reply: FastifyReply) => {
    const query = getFinanceExportQuerySchema.parse(req.query);
    const res = await Finance.exportCsv(query.from, query.to);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${res.filename}"`);
    return reply.send(res.csv);
  };
  app.get('/finance/export', { preHandler: [guard('finance:read')] }, handleGetExport);

  // 5. Share Snapshot (P1)
  const handleShare = async (req: FastifyRequest) => {
    const body = shareFinanceRequestSchema.parse(req.body);
    return Finance.createShareLink(body.from, body.to);
  };
  app.post('/finance/share', { preHandler: [guard('finance:share')] }, handleShare);
}
