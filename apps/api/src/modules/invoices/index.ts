// Owner: Dev B – Invoices Module Router
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getInvoicesQuerySchema,
  getInvoiceParamsSchema,
  getInvoicePdfParamsSchema,
  createInvoiceRequestSchema,
  SessionUser,
} from '@club/contract';
import { Invoices, InvoicesService } from './service.js';
import { guard } from '../../core/rbac.js';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';

export { Invoices, InvoicesService };

export async function register(app: FastifyInstance) {
  // 1. GET /invoices
  const handleGetInvoices = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const query = getInvoicesQuerySchema.parse(req.query);

    // If member, enforce memberId = own memberId
    if (user?.roleCode === 'member') {
      if (query.memberId && query.memberId !== user.memberId) {
        throw new AppError('FORBIDDEN', 'Members can only view their own invoices', 403);
      }
      query.memberId = user.memberId ?? undefined;
    }

    return Invoices.listInvoices(query);
  };
  app.get(
    '/api/invoices',
    { preHandler: [guard('invoice:read', (req) => (req.query as any)?.memberId ?? undefined)] },
    handleGetInvoices
  );
  app.get(
    '/invoices',
    { preHandler: [guard('invoice:read', (req) => (req.query as any)?.memberId ?? undefined)] },
    handleGetInvoices
  );

  // 2. GET /invoices/:id
  const handleGetInvoice = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = getInvoiceParamsSchema.parse(req.params);
    const inv = await Invoices.getInvoice(id);

    if (user?.roleCode === 'member' && inv.memberId !== user.memberId) {
      throw new AppError('FORBIDDEN', 'Members can only view their own invoices', 403);
    }
    return inv;
  };
  app.get(
    '/api/invoices/:id',
    {
      preHandler: [
        guard('invoice:read', async (req) => {
          const inv = await Invoices.getInvoice((req.params as any).id);
          return inv.memberId ?? undefined;
        }),
      ],
    },
    handleGetInvoice
  );
  app.get(
    '/invoices/:id',
    {
      preHandler: [
        guard('invoice:read', async (req) => {
          const inv = await Invoices.getInvoice((req.params as any).id);
          return inv.memberId ?? undefined;
        }),
      ],
    },
    handleGetInvoice
  );

  // 3. GET /invoices/:id/pdf
  const handleGetPdf = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = getInvoicePdfParamsSchema.parse(req.params);
    const inv = await Invoices.getInvoice(id);

    if (user?.roleCode === 'member' && inv.memberId !== user.memberId) {
      throw new AppError('FORBIDDEN', 'Members can only view their own invoices', 403);
    }

    const html = await Invoices.renderInvoicePdfHtml(id);
    return reply.type('text/html').send(html);
  };
  app.get('/invoices/:id/pdf', { preHandler: [guard('invoice:read')] }, handleGetPdf);

  // 4. POST /invoices (manual / corporate invoice)
  const handleCreateInvoice = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createInvoiceRequestSchema.parse(req.body);

    const res = await Invoices.create({
      customer: body.customer,
      lines: body.lines.map((l) => ({
        source: l.source,
        description: l.description,
        qty: l.qty,
        unitPricePaise: l.unitPricePaise,
        discountPaise: l.discountPaise,
        taxCategory: l.taxCategory,
        refType: l.refType ?? 'manual',
        refId: l.refId ?? '',
      })),
      dueOn: body.dueOn ? new Date(body.dueOn) : undefined,
    });

    await Audit.log({
      actor: user?.id ?? 'system',
      action: 'create',
      resource: 'invoice',
      recordId: res.invoiceId,
      after: res,
    });

    return reply.status(201).send({ ...res, status: 'issued' });
  };
  app.post('/invoices', { preHandler: [guard('invoice:create')] }, handleCreateInvoice);
}
