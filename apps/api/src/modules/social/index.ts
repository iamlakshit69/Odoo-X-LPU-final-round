// Owner: Dev A – Phase 6: Social play module router
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getSocialSessionsQuerySchema,
  createSocialSessionRequestSchema,
  signupSocialSessionParamsSchema,
  signupSocialSessionRequestSchema,
  cancelSocialSignupParamsSchema,
  cancelSocialSignupRequestSchema,
  SessionUser,
} from '@club/contract';
import { Social, SocialService } from './service.js';
import { guard } from '../../core/rbac.js';
import { AppError } from '../../core/errors.js';

export { Social, SocialService };

export async function register(app: FastifyInstance) {
  // 1. GET /api/social/sessions
  const handleListSessions = async (req: FastifyRequest) => {
    const query = getSocialSessionsQuerySchema.parse(req.query || {});
    return Social.listSessions(query);
  };
  app.get('/api/social/sessions', handleListSessions);
  app.get('/social/sessions', handleListSessions);

  // 2. POST /api/social/sessions
  const handleCreateSession = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createSocialSessionRequestSchema.parse(req.body);
    const res = await Social.createSession(body, user);
    return reply.status(201).send(res);
  };
  app.post('/api/social/sessions', { preHandler: [guard('court:manage')] }, handleCreateSession);
  app.post('/social/sessions', { preHandler: [guard('court:manage')] }, handleCreateSession);

  // 3. POST /api/social/sessions/:id/signup
  const handleSignup = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = signupSocialSessionParamsSchema.parse(req.params);
    const body = signupSocialSessionRequestSchema.parse(req.body);

    if (user?.roleCode === 'member' && body.memberId !== user.memberId) {
      throw new AppError('FORBIDDEN', 'Members can only sign up themselves for social play', 403);
    }

    const res = await Social.signup(id, body.memberId, user);
    return reply.status(201).send(res);
  };
  app.post(
    '/api/social/sessions/:id/signup',
    {
      preHandler: [guard('booking:create', (req) => (req.body as any)?.memberId ?? undefined)],
    },
    handleSignup
  );
  app.post(
    '/social/sessions/:id/signup',
    {
      preHandler: [guard('booking:create', (req) => (req.body as any)?.memberId ?? undefined)],
    },
    handleSignup
  );

  // 4. POST /api/social/sessions/:id/cancel-signup
  const handleCancelSignup = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = cancelSocialSignupParamsSchema.parse(req.params);
    const body = cancelSocialSignupRequestSchema.parse(req.body);

    if (user?.roleCode === 'member' && body.memberId !== user.memberId) {
      throw new AppError('FORBIDDEN', 'Members can only cancel their own social play signup', 403);
    }

    return Social.cancelSignup(id, body.memberId, user);
  };
  app.post(
    '/api/social/sessions/:id/cancel-signup',
    {
      preHandler: [guard('booking:cancel', (req) => (req.body as any)?.memberId ?? undefined)],
    },
    handleCancelSignup
  );
  app.post(
    '/social/sessions/:id/cancel-signup',
    {
      preHandler: [guard('booking:cancel', (req) => (req.body as any)?.memberId ?? undefined)],
    },
    handleCancelSignup
  );
}
