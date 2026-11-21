// Owner: Dev B – Tax Module Router
import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  updateTaxRateParamsSchema,
  updateTaxRateRequestSchema,
  SessionUser,
} from '@club/contract';
import { Tax, TaxService, computeLineTax } from './service.js';
import { guard } from '../../core/rbac.js';

export { Tax, TaxService, computeLineTax };

export async function register(app: FastifyInstance) {
  // GET /admin/tax-rates
  const handleGetTaxRates = async () => {
    return Tax.getTaxRates();
  };
  app.get('/api/admin/tax-rates', { preHandler: [guard('tax:manage')] }, handleGetTaxRates);
  app.get('/admin/tax-rates', { preHandler: [guard('tax:manage')] }, handleGetTaxRates);

  // PUT /admin/tax-rates/:id
  const handleUpdateTaxRate = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateTaxRateParamsSchema.parse(req.params);
    const body = updateTaxRateRequestSchema.parse(req.body);
    return Tax.updateTaxRate(id, body, user?.id);
  };
  app.put('/api/admin/tax-rates/:id', { preHandler: [guard('tax:manage')] }, handleUpdateTaxRate);
  app.put('/admin/tax-rates/:id', { preHandler: [guard('tax:manage')] }, handleUpdateTaxRate);
}
