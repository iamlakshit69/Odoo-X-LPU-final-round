import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createMemberRequestSchema,
  renewMembershipRequestSchema,
  changePlanRequestSchema,
  suspendMemberRequestSchema,
  checkinRequestSchema,
  SessionUser,
} from '@club/contract';
import { guard } from '../../core/rbac.js';
import { Members, MembersService } from './service.js';

export { Members, MembersService };

export async function register(app: FastifyInstance) {
  // 1. GET /plans (public)
  app.get('/plans', async () => {
    return Members.getPlans();
  });

  // 2. POST /members
  app.post(
    '/members',
    {
      preHandler: [guard('member:create')],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = createMemberRequestSchema.parse(req.body);
      const user = (req as any).user as SessionUser | undefined;
      const res = await Members.createMember(parsed, user?.id);
      return reply.status(201).send(res);
    }
  );

  // 3. GET /members
  app.get(
    '/members',
    {
      preHandler: [guard('member:read')],
    },
    async (req: FastifyRequest) => {
      const query = (req.query as any) || {};
      return Members.searchMembers({
        q: query.q,
        status: query.status,
        planCode: query.planCode,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
      });
    }
  );

  // 4. GET /members/:id
  app.get(
    '/members/:id',
    {
      preHandler: [guard('member:read', (req) => (req.params as any).id)],
    },
    async (req: FastifyRequest) => {
      const { id } = req.params as { id: string };
      return Members.getMember(id);
    }
  );

  // 5. GET /members/:id/timeline
  app.get(
    '/members/:id/timeline',
    {
      preHandler: [guard('member:read', (req) => (req.params as any).id)],
    },
    async (req: FastifyRequest) => {
      const { id } = req.params as { id: string };
      return Members.getTimeline(id);
    }
  );

  // 6. POST /members/:id/renew
  app.post(
    '/members/:id/renew',
    {
      preHandler: [guard('member:update', (req) => (req.params as any).id)],
    },
    async (req: FastifyRequest) => {
      const { id } = req.params as { id: string };
      const body = (req.body ? renewMembershipRequestSchema.parse(req.body) : {}) as any;
      const user = (req as any).user as SessionUser | undefined;
      return Members.renewMembership(id, body.planCode, user?.id);
    }
  );

  // 7. POST /members/:id/change-plan
  app.post(
    '/members/:id/change-plan',
    {
      preHandler: [guard('member:update', (req) => (req.params as any).id)],
    },
    async (req: FastifyRequest) => {
      const { id } = req.params as { id: string };
      const body = changePlanRequestSchema.parse(req.body);
      const user = (req as any).user as SessionUser | undefined;
      return Members.changePlan(id, body.newPlanCode, user?.id);
    }
  );

  // 8. POST /members/:id/suspend
  app.post(
    '/members/:id/suspend',
    {
      preHandler: [guard('member:update', (req) => (req.params as any).id)],
    },
    async (req: FastifyRequest) => {
      const { id } = req.params as { id: string };
      const body = (req.body ? suspendMemberRequestSchema.parse(req.body) : {}) as any;
      const user = (req as any).user as SessionUser | undefined;
      return Members.suspendMember(id, body?.reason, user?.id);
    }
  );

  // 9. POST /members/:id/reinstate
  app.post(
    '/members/:id/reinstate',
    {
      preHandler: [guard('member:update', (req) => (req.params as any).id)],
    },
    async (req: FastifyRequest) => {
      const { id } = req.params as { id: string };
      const user = (req as any).user as SessionUser | undefined;
      return Members.reinstateMember(id, user?.id);
    }
  );

  // 10. POST /checkins
  app.post(
    '/checkins',
    {
      preHandler: [guard('checkin:create')],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = checkinRequestSchema.parse(req.body);
      const user = (req as any).user as SessionUser | undefined;
      const res = await Members.checkin({
        qrToken: body.qrToken,
        memberId: body.memberId,
        method: body.method,
        staffUserId: user?.id,
      });
      return reply.status(201).send(res);
    }
  );

  // 11. GET /checkins/current
  app.get(
    '/checkins/current',
    {
      preHandler: [guard('member:read')],
    },
    async () => {
      return Members.getCurrentCheckins();
    }
  );
}
