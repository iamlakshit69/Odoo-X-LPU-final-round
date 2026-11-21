// Owner: Dev B – Payments Module Router
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createPaymentParamsSchema,
  createPaymentRequestSchema,
  SessionUser,
} from '@club/contract';
import { Payments, PaymentsService } from './service.js';
import { guard } from '../../core/rbac.js';

export { Payments, PaymentsService };

export async function register(app: FastifyInstance) {
  // POST /invoices/:id/payments
  const handleCreatePayment = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = createPaymentParamsSchema.parse(req.params);
    const body = createPaymentRequestSchema.parse(req.body);

    const res = await Payments.record(
      {
        invoiceId: id,
        method: body.method,
        amountPaise: body.amountPaise,
        reference: body.reference,
        tillSessionId: body.tillSessionId,
      },
      undefined,
      user?.id
    );

    return reply.status(201).send({
      paymentId: res.paymentId,
      invoiceId: id,
      amountPaise: body.amountPaise,
      outstandingPaise: res.outstandingPaise,
      status: res.status,
    });
  };

  app.post(
    '/api/invoices/:id/payments',
    { preHandler: [guard('payment:create')] },
    handleCreatePayment
  );
  app.post(
    '/invoices/:id/payments',
    { preHandler: [guard('payment:create')] },
    handleCreatePayment
  );
}
