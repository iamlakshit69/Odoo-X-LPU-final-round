// Owner: Dev B – Expenses Module Router
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getExpensesQuerySchema,
  createExpenseRequestSchema,
  updateExpenseParamsSchema,
  updateExpenseRequestSchema,
  approveExpenseParamsSchema,
  approveExpenseRequestSchema,
  SessionUser,
} from '@club/contract';
import { Expenses, ExpensesService } from './service.js';
import { guard } from '../../core/rbac.js';

export { Expenses, ExpensesService };

export async function register(app: FastifyInstance) {
  // GET /expenses
  const handleGetExpenses = async (req: FastifyRequest) => {
    const query = getExpensesQuerySchema.parse(req.query);
    return Expenses.listExpenses(query);
  };
  app.get('/expenses', { preHandler: [guard('expense:manage')] }, handleGetExpenses);

  // POST /expenses
  const handleCreateExpense = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createExpenseRequestSchema.parse(req.body);
    const res = await Expenses.createExpense(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/expenses', { preHandler: [guard('expense:manage')] }, handleCreateExpense);

  // GET /expenses/:id
  const handleGetExpense = async (req: FastifyRequest) => {
    const { id } = updateExpenseParamsSchema.parse(req.params);
    return Expenses.getExpense(id);
  };
  app.get('/expenses/:id', { preHandler: [guard('expense:manage')] }, handleGetExpense);

  // PATCH /expenses/:id
  const handleUpdateExpense = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateExpenseParamsSchema.parse(req.params);
    const body = updateExpenseRequestSchema.parse(req.body);
    return Expenses.updateExpense(id, body, user?.id);
  };
  app.patch('/expenses/:id', { preHandler: [guard('expense:manage')] }, handleUpdateExpense);

  // POST /expenses/:id/approve
  const handleApproveExpense = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = approveExpenseParamsSchema.parse(req.params);
    const body = approveExpenseRequestSchema.parse(req.body);
    return Expenses.decideExpense(id, body.approve, user?.id);
  };
  app.post('/expenses/:id/approve', { preHandler: [guard('expense:approve')] }, handleApproveExpense);
}
