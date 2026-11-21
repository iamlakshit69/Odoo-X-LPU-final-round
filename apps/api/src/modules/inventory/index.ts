// Owner: Dev B – Inventory Module Router
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getStockQuerySchema,
  createStockMovementRequestSchema,
  SessionUser,
} from '@club/contract';
import { Inventory, InventoryService } from './service.js';
import { guard } from '../../core/rbac.js';

export { Inventory, InventoryService };

export async function register(app: FastifyInstance) {
  // GET /stock?lowOnly=
  const handleGetStock = async (req: FastifyRequest) => {
    const query = getStockQuerySchema.parse(req.query);
    return Inventory.getStock(query);
  };
  app.get('/stock', { preHandler: [guard('stock:read')] }, handleGetStock);

  // POST /stock/movements
  const handleStockMovement = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createStockMovementRequestSchema.parse(req.body);
    const res = await Inventory.recordMovement(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/stock/movements', { preHandler: [guard('stock:adjust')] }, handleStockMovement);
}
