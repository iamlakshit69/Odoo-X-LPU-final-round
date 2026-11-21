// Owner: Dev B – HR Module Router (Section 7.9)
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getEmployeesQuerySchema,
  createEmployeeRequestSchema,
  updateEmployeeParamsSchema,
  updateEmployeeRequestSchema,
  getWorkShiftsQuerySchema,
  createWorkShiftRequestSchema,
  updateWorkShiftParamsSchema,
  updateWorkShiftRequestSchema,
  deleteWorkShiftParamsSchema,
  getSalaryComponentsQuerySchema,
  createSalaryComponentRequestSchema,
  updateSalaryComponentParamsSchema,
  updateSalaryComponentRequestSchema,
  deleteSalaryComponentParamsSchema,
  getLeaveBalancesQuerySchema,
  createLeaveRequestSchema,
  decideLeaveRequestParamsSchema,
  approveLeaveRequestSchema,
  rejectLeaveRequestSchema,
  runPayrollRequestSchema,
  getPayslipsQuerySchema,
  SessionUser,
} from '@club/contract';
import { Hr, HrService } from './service.js';
import { guard } from '../../core/rbac.js';
import { AppError } from '../../core/errors.js';

export { Hr, HrService };

export async function register(app: FastifyInstance) {
  // 1. Employees CRUD
  const handleGetEmployees = async (req: FastifyRequest) => {
    const query = getEmployeesQuerySchema.parse(req.query);
    return Hr.listEmployees(query);
  };
  app.get('/employees', { preHandler: [guard('hr:read')] }, handleGetEmployees);

  const handleCreateEmployee = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createEmployeeRequestSchema.parse(req.body);
    const res = await Hr.createEmployee(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/employees', { preHandler: [guard('hr:manage')] }, handleCreateEmployee);

  const handleGetEmployee = async (req: FastifyRequest) => {
    const { id } = updateEmployeeParamsSchema.parse(req.params);
    return Hr.getEmployee(id);
  };
  app.get('/employees/:id', { preHandler: [guard('hr:read')] }, handleGetEmployee);

  const handleUpdateEmployee = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateEmployeeParamsSchema.parse(req.params);
    const body = updateEmployeeRequestSchema.parse(req.body);
    return Hr.updateEmployee(id, body, user?.id);
  };
  app.patch('/employees/:id', { preHandler: [guard('hr:manage')] }, handleUpdateEmployee);

  const handleDeleteEmployee = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateEmployeeParamsSchema.parse(req.params);
    return Hr.deleteEmployee(id, user?.id);
  };
  app.delete('/employees/:id', { preHandler: [guard('hr:manage')] }, handleDeleteEmployee);

  // 2. Work Shifts CRUD
  const handleGetWorkShifts = async (req: FastifyRequest) => {
    const query = getWorkShiftsQuerySchema.parse(req.query);
    return Hr.listWorkShifts(query);
  };
  app.get('/work-shifts', { preHandler: [guard('hr:read')] }, handleGetWorkShifts);

  const handleCreateWorkShift = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createWorkShiftRequestSchema.parse(req.body);
    const res = await Hr.createWorkShift(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/work-shifts', { preHandler: [guard('hr:manage')] }, handleCreateWorkShift);

  const handleGetWorkShift = async (req: FastifyRequest) => {
    const { id } = updateWorkShiftParamsSchema.parse(req.params);
    return Hr.getWorkShift(id);
  };
  app.get('/work-shifts/:id', { preHandler: [guard('hr:read')] }, handleGetWorkShift);

  const handleUpdateWorkShift = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateWorkShiftParamsSchema.parse(req.params);
    const body = updateWorkShiftRequestSchema.parse(req.body);
    return Hr.updateWorkShift(id, body, user?.id);
  };
  app.patch('/work-shifts/:id', { preHandler: [guard('hr:manage')] }, handleUpdateWorkShift);

  const handleDeleteWorkShift = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = deleteWorkShiftParamsSchema.parse(req.params);
    return Hr.deleteWorkShift(id, user?.id);
  };
  app.delete('/work-shifts/:id', { preHandler: [guard('hr:manage')] }, handleDeleteWorkShift);

  // 3. Salary Components CRUD
  const handleGetSalaryComponents = async (req: FastifyRequest) => {
    const { employeeId } = getSalaryComponentsQuerySchema.parse(req.query);
    return Hr.listSalaryComponents(employeeId);
  };
  app.get('/salary-components', { preHandler: [guard('hr:manage')] }, handleGetSalaryComponents);

  const handleCreateSalaryComponent = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createSalaryComponentRequestSchema.parse(req.body);
    const res = await Hr.createSalaryComponent(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/salary-components', { preHandler: [guard('hr:manage')] }, handleCreateSalaryComponent);

  const handleUpdateSalaryComponent = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateSalaryComponentParamsSchema.parse(req.params);
    const body = updateSalaryComponentRequestSchema.parse(req.body);
    return Hr.updateSalaryComponent(id, body, user?.id);
  };
  app.patch('/salary-components/:id', { preHandler: [guard('hr:manage')] }, handleUpdateSalaryComponent);

  const handleDeleteSalaryComponent = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = deleteSalaryComponentParamsSchema.parse(req.params);
    return Hr.deleteSalaryComponent(id, user?.id);
  };
  app.delete('/salary-components/:id', { preHandler: [guard('hr:manage')] }, handleDeleteSalaryComponent);

  // 4. Leave Balances & Requests
  const handleGetLeaveBalances = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { employeeId } = getLeaveBalancesQuerySchema.parse(req.query);

    if (user?.roleCode === 'member') {
      throw new AppError('FORBIDDEN', 'Access forbidden', 403);
    }
    return Hr.getLeaveBalances(employeeId);
  };
  app.get('/leave/balances', { preHandler: [guard('hr:read')] }, handleGetLeaveBalances);

  const handleListLeaveRequests = async (req: FastifyRequest) => {
    const { employeeId, status } = req.query as { employeeId?: string; status?: string };
    return Hr.listLeaveRequests({ employeeId, status });
  };
  app.get('/leave/requests', { preHandler: [guard('hr:read')] }, handleListLeaveRequests);

  const handleCreateLeaveRequest = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createLeaveRequestSchema.parse(req.body);
    const res = await Hr.createLeaveRequest(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/leave/requests', { preHandler: [guard('hr:read')] }, handleCreateLeaveRequest);

  const handleApproveLeave = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = decideLeaveRequestParamsSchema.parse(req.params);
    const body = approveLeaveRequestSchema.parse(req.body || {});
    return Hr.decideLeaveRequest(id, true, body.note, user?.id);
  };
  app.post('/leave/requests/:id/approve', { preHandler: [guard('leave:approve')] }, handleApproveLeave);

  const handleRejectLeave = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = decideLeaveRequestParamsSchema.parse(req.params);
    const body = rejectLeaveRequestSchema.parse(req.body);
    return Hr.decideLeaveRequest(id, false, body.reason, user?.id);
  };
  app.post('/leave/requests/:id/reject', { preHandler: [guard('leave:approve')] }, handleRejectLeave);

  // 5. Payroll
  const handleRunPayroll = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = runPayrollRequestSchema.parse(req.body);
    const month = body.monthOn ?? body.month;
    if (!month) {
      throw new AppError('VALIDATION', 'month is required', 400);
    }
    const res = await Hr.runPayroll(month, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/payroll/run', { preHandler: [guard('payroll:run')] }, handleRunPayroll);

  const handleGetPayslips = async (req: FastifyRequest) => {
    const query = getPayslipsQuerySchema.parse(req.query);
    return Hr.listPayslips(query);
  };
  app.get('/payslips', { preHandler: [guard('payroll:read')] }, handleGetPayslips);
}
