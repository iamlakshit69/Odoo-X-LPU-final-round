// Owner: Dev A – Phase 6: Bookings module router
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createBookingRequestSchema,
  cancelBookingParamsSchema,
  cancelBookingRequestSchema,
  markNoShowParamsSchema,
  completeBookingParamsSchema,
  createBlockBookingRequestSchema,
  getBookingsQuerySchema,
  getBookingParamsSchema,
  SessionUser,
} from '@club/contract';
import { Bookings, BookingsService } from './service.js';
import { guard } from '../../core/rbac.js';
import { AppError } from '../../core/errors.js';

export { Bookings, BookingsService };

export async function register(app: FastifyInstance) {
  // 1. POST /api/bookings
  const handleCreateBooking = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createBookingRequestSchema.parse(req.body);

    // If user is member, ensure they can only book for themselves
    if (user?.roleCode === 'member') {
      if (body.memberId && body.memberId !== user.memberId) {
        throw new AppError('FORBIDDEN', 'Members can only create bookings for themselves', 403);
      }
      if (!body.memberId && user.memberId) {
        body.memberId = user.memberId;
      }
    }

    const res = await Bookings.createBooking(body, user);
    return reply.status(201).send(res);
  };
  app.post(
    '/api/bookings',
    {
      preHandler: [guard('booking:create', (req) => (req.body as any)?.memberId ?? undefined)],
    },
    handleCreateBooking
  );
  app.post(
    '/bookings',
    {
      preHandler: [guard('booking:create', (req) => (req.body as any)?.memberId ?? undefined)],
    },
    handleCreateBooking
  );

  // 2. POST /api/bookings/:id/cancel
  const handleCancelBooking = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = cancelBookingParamsSchema.parse(req.params);
    const body = cancelBookingRequestSchema.parse(req.body || {});
    return Bookings.cancelBooking(id, body, user);
  };
  app.post(
    '/api/bookings/:id/cancel',
    {
      preHandler: [guard('booking:cancel', async (req) => {
        const b = await Bookings.getBooking((req.params as any).id);
        return b.memberId ?? undefined;
      })],
    },
    handleCancelBooking
  );
  app.post(
    '/bookings/:id/cancel',
    {
      preHandler: [guard('booking:cancel', async (req) => {
        const b = await Bookings.getBooking((req.params as any).id);
        return b.memberId ?? undefined;
      })],
    },
    handleCancelBooking
  );

  // 3. POST /api/bookings/:id/no-show
  const handleNoShow = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = markNoShowParamsSchema.parse(req.params);
    return Bookings.markNoShow(id, user);
  };
  app.post('/bookings/:id/no-show', { preHandler: [guard('booking:update')] }, handleNoShow);

  // 4. POST /api/bookings/:id/complete
  const handleComplete = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = completeBookingParamsSchema.parse(req.params);
    return Bookings.completeBooking(id, user);
  };
  app.post('/bookings/:id/complete', { preHandler: [guard('booking:update')] }, handleComplete);

  // 5. POST /api/bookings/blocks (maintenance block)
  const handleBlock = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createBlockBookingRequestSchema.parse(req.body);
    const res = await Bookings.createBlockBooking(body, user);
    return reply.status(201).send(res);
  };
  app.post('/bookings/blocks', { preHandler: [guard('booking:block')] }, handleBlock);

  // 6. GET /api/bookings
  const handleListBookings = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const query = getBookingsQuerySchema.parse(req.query || {});
    return Bookings.listBookings(query, user);
  };
  app.get(
    '/api/bookings',
    {
      preHandler: [guard('booking:read', (req) => (req.query as any)?.memberId)],
    },
    handleListBookings
  );
  app.get(
    '/bookings',
    {
      preHandler: [guard('booking:read', (req) => (req.query as any)?.memberId)],
    },
    handleListBookings
  );

  // 7. GET /api/bookings/:id
  const handleGetBooking = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = getBookingParamsSchema.parse(req.params);
    return Bookings.getBooking(id, user);
  };
  app.get(
    '/api/bookings/:id',
    {
      preHandler: [guard('booking:read', async (req) => {
        const b = await Bookings.getBooking((req.params as any).id);
        return b.memberId ?? undefined;
      })],
    },
    handleGetBooking
  );
  app.get(
    '/bookings/:id',
    {
      preHandler: [guard('booking:read', async (req) => {
        const b = await Bookings.getBooking((req.params as any).id);
        return b.memberId ?? undefined;
      })],
    },
    handleGetBooking
  );
}
