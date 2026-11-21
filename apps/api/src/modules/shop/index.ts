// Owner: Dev B – Shop Module Router (Section 7.6)
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getPublicProductsQuerySchema,
  getPublicProductParamsSchema,
  getProductsQuerySchema,
  createProductRequestSchema,
  updateProductParamsSchema,
  updateProductRequestSchema,
  createVariantRequestSchema,
  updateVariantParamsSchema,
  updateVariantRequestSchema,
  createOrderRequestSchema,
  updateOrderStatusParamsSchema,
  updateOrderStatusRequestSchema,
  getOrdersQuerySchema,
  getOrderParamsSchema,
  SessionUser,
} from '@club/contract';
import { Shop, ShopService } from './service.js';
import { guard } from '../../core/rbac.js';
import { rateLimitMiddleware } from '../../core/rateLimit.js';
import { AppError } from '../../core/errors.js';

export { Shop, ShopService };

export async function register(app: FastifyInstance) {
  // 1. GET /public/products (Rate limited, no PII, boolean inStock only)
  const handlePublicProducts = async (req: FastifyRequest) => {
    const query = getPublicProductsQuerySchema.parse(req.query);
    return Shop.getPublicProducts(query);
  };
  app.get('/public/products', { preHandler: [rateLimitMiddleware(20, 60_000)] }, handlePublicProducts);

  // 2. GET /public/products/:id
  const handlePublicProductDetail = async (req: FastifyRequest) => {
    const { id } = getPublicProductParamsSchema.parse(req.params);
    return Shop.getPublicProduct(id);
  };
  app.get('/public/products/:id', { preHandler: [rateLimitMiddleware(30, 60_000)] }, handlePublicProductDetail);

  // 3. GET /products
  const handleGetProducts = async (req: FastifyRequest) => {
    const query = getProductsQuerySchema.parse(req.query);
    return Shop.getProducts(query);
  };
  app.get('/products', { preHandler: [guard('product:manage')] }, handleGetProducts);

  // 4. POST /products
  const handleCreateProduct = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createProductRequestSchema.parse(req.body);
    const res = await Shop.createProduct(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/products', { preHandler: [guard('product:manage')] }, handleCreateProduct);

  // 5. PATCH /products/:id
  const handleUpdateProduct = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateProductParamsSchema.parse(req.params);
    const body = updateProductRequestSchema.parse(req.body);
    return Shop.updateProduct(id, body, user?.id);
  };
  app.patch('/products/:id', { preHandler: [guard('product:manage')] }, handleUpdateProduct);

  // 6. POST /variants
  const handleCreateVariant = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createVariantRequestSchema.parse(req.body);
    const res = await Shop.createVariant(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/variants', { preHandler: [guard('product:manage')] }, handleCreateVariant);

  // 7. PATCH /variants/:id
  const handleUpdateVariant = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateVariantParamsSchema.parse(req.params);
    const body = updateVariantRequestSchema.parse(req.body);
    return Shop.updateVariant(id, body, user?.id);
  };
  app.patch('/variants/:id', { preHandler: [guard('product:manage')] }, handleUpdateVariant);

  // 8. POST /orders
  const handleCreateOrder = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createOrderRequestSchema.parse(req.body);

    if (user?.roleCode === 'member') {
      if (body.memberId && body.memberId !== user.memberId) {
        throw new AppError('FORBIDDEN', 'Members can only create orders for themselves', 403);
      }
      body.memberId = user.memberId ?? undefined;
    }

    const res = await Shop.createOrder(body, user);
    return reply.status(201).send(res);
  };
  app.post(
    '/api/orders',
    { preHandler: [guard('order:create', (req) => (req.body as any)?.memberId ?? undefined)] },
    handleCreateOrder
  );
  app.post(
    '/orders',
    { preHandler: [guard('order:create', (req) => (req.body as any)?.memberId ?? undefined)] },
    handleCreateOrder
  );

  // 9. POST /orders/:id/status
  const handleUpdateOrderStatus = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateOrderStatusParamsSchema.parse(req.params);
    const { status } = updateOrderStatusRequestSchema.parse(req.body);

    const ord = await Shop.getOrder(id);
    if (user?.roleCode === 'member' && ord.memberId !== user.memberId) {
      throw new AppError('FORBIDDEN', 'Members can only update their own orders', 403);
    }

    return Shop.updateOrderStatus(id, status, user);
  };
  app.post(
    '/api/orders/:id/status',
    {
      preHandler: [
        guard('order:update', async (req) => {
          const ord = await Shop.getOrder((req.params as any).id);
          return ord.memberId ?? undefined;
        }),
      ],
    },
    handleUpdateOrderStatus
  );
  app.post(
    '/orders/:id/status',
    {
      preHandler: [
        guard('order:update', async (req) => {
          const ord = await Shop.getOrder((req.params as any).id);
          return ord.memberId ?? undefined;
        }),
      ],
    },
    handleUpdateOrderStatus
  );

  // 10. GET /orders
  const handleGetOrders = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const query = getOrdersQuerySchema.parse(req.query);

    if (user?.roleCode === 'member') {
      if (query.memberId && query.memberId !== user.memberId) {
        throw new AppError('FORBIDDEN', 'Members can only view their own orders', 403);
      }
      query.memberId = user.memberId ?? undefined;
    }

    return Shop.listOrders(query);
  };
  app.get(
    '/api/orders',
    { preHandler: [guard('order:read', (req) => (req.query as any)?.memberId ?? undefined)] },
    handleGetOrders
  );
  app.get(
    '/orders',
    { preHandler: [guard('order:read', (req) => (req.query as any)?.memberId ?? undefined)] },
    handleGetOrders
  );

  // 11. GET /orders/:id
  const handleGetOrder = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = getOrderParamsSchema.parse(req.params);
    const ord = await Shop.getOrder(id);

    if (user?.roleCode === 'member' && ord.memberId !== user.memberId) {
      throw new AppError('FORBIDDEN', 'Members can only view their own orders', 403);
    }
    return ord;
  };
  app.get(
    '/api/orders/:id',
    {
      preHandler: [
        guard('order:read', async (req) => {
          const ord = await Shop.getOrder((req.params as any).id);
          return ord.memberId ?? undefined;
        }),
      ],
    },
    handleGetOrder
  );
  app.get(
    '/orders/:id',
    {
      preHandler: [
        guard('order:read', async (req) => {
          const ord = await Shop.getOrder((req.params as any).id);
          return ord.memberId ?? undefined;
        }),
      ],
    },
    handleGetOrder
  );
}
