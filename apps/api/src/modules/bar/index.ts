// Owner: Dev B – Bar Module Router (Section 7.7)
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getMenuQuerySchema,
  createMenuItemRequestSchema,
  updateMenuItemParamsSchema,
  updateMenuItemRequestSchema,
  createTableRequestSchema,
  openTillRequestSchema,
  closeTillRequestSchema,
  createTabRequestSchema,
  addTabItemParamsSchema,
  addTabItemRequestSchema,
  updateTabItemStatusParamsSchema,
  updateTabItemStatusRequestSchema,
  voidTabItemParamsSchema,
  voidTabItemRequestSchema,
  settleTabParamsSchema,
  settleTabRequestSchema,
  transferTabParamsSchema,
  transferTabRequestSchema,
  mergeTabParamsSchema,
  mergeTabRequestSchema,
  getKdsQuerySchema,
  getZReportQuerySchema,
  SessionUser,
} from '@club/contract';
import { Bar, BarService } from './service.js';
import { guard } from '../../core/rbac.js';
import { AppError } from '../../core/errors.js';

export { Bar, BarService };

export async function register(app: FastifyInstance) {
  // 1. Menu Routes
  const handleGetMenu = async (req: FastifyRequest) => {
    const query = getMenuQuerySchema.parse(req.query);
    return Bar.getMenu(query);
  };
  app.get('/admin/menu', { preHandler: [guard('menu:manage')] }, handleGetMenu);

  const handleCreateMenuItem = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createMenuItemRequestSchema.parse(req.body);
    const res = await Bar.createMenuItem(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/admin/menu', { preHandler: [guard('menu:manage')] }, handleCreateMenuItem);

  const handleUpdateMenuItem = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateMenuItemParamsSchema.parse(req.params);
    const body = updateMenuItemRequestSchema.parse(req.body);
    return Bar.updateMenuItem(id, body, user?.id);
  };
  app.patch('/admin/menu/:id', { preHandler: [guard('menu:manage')] }, handleUpdateMenuItem);

  // 2. Table Routes
  const handleGetTables = async () => {
    return Bar.getTables();
  };
  app.get('/admin/tables', { preHandler: [guard('menu:manage')] }, handleGetTables);

  const handleCreateTable = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = createTableRequestSchema.parse(req.body);
    const res = await Bar.createTable(body, user?.id);
    return reply.status(201).send(res);
  };
  app.post('/admin/tables', { preHandler: [guard('menu:manage')] }, handleCreateTable);

  // 3. Till Routes
  const handleOpenTill = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    if (!user) throw new AppError('UNAUTHENTICATED', 'Must be logged in to open till', 401);
    const body = openTillRequestSchema.parse(req.body);
    const res = await Bar.openTill(body, user.id);
    return reply.status(201).send(res);
  };
  app.post('/till/open', { preHandler: [guard('till:manage')] }, handleOpenTill);

  const handleCloseTill = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const body = closeTillRequestSchema.parse(req.body);
    return Bar.closeTill(body, user?.id);
  };
  app.post('/till/close', { preHandler: [guard('till:manage')] }, handleCloseTill);

  // 4. Tab Routes
  const handleCreateTab = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    if (!user) throw new AppError('UNAUTHENTICATED', 'Must be logged in to create tab', 401);
    const body = createTabRequestSchema.parse(req.body);
    const res = await Bar.createTab(body, user);
    return reply.status(201).send(res);
  };
  app.post('/tabs', { preHandler: [guard('tab:create')] }, handleCreateTab);

  const handleGetTab = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = req.params as { id: string };
    const tab = await Bar.getTab(id);

    if (user?.roleCode === 'member' && tab.memberId !== user.memberId) {
      throw new AppError('FORBIDDEN', 'Members can only view their own tabs', 403);
    }
    return tab;
  };
  app.get('/tabs/:id', { preHandler: [guard('tab:read')] }, handleGetTab);

  const handleAddTabItem = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = addTabItemParamsSchema.parse(req.params);
    const body = addTabItemRequestSchema.parse(req.body);
    const res = await Bar.addItemToTab(id, body, user);
    return reply.status(201).send(res);
  };
  app.post('/tabs/:id/items', { preHandler: [guard('tab:update')] }, handleAddTabItem);

  const handleUpdateItemStatus = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = updateTabItemStatusParamsSchema.parse(req.params);
    const { status } = updateTabItemStatusRequestSchema.parse(req.body);
    return Bar.updateTabItemStatus(id, status, user);
  };
  app.post('/tab-items/:id/status', { preHandler: [guard('kds:update')] }, handleUpdateItemStatus);

  const handleVoidItem = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = voidTabItemParamsSchema.parse(req.params);
    const { voidReason } = voidTabItemRequestSchema.parse(req.body);
    return Bar.voidTabItem(id, voidReason, user);
  };
  app.post('/tab-items/:id/void', { preHandler: [guard('tab:void')] }, handleVoidItem);

  const handleSettleTab = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = settleTabParamsSchema.parse(req.params);
    const body = settleTabRequestSchema.parse(req.body);
    return Bar.settleTab(id, body, user);
  };
  app.post('/tabs/:id/settle', { preHandler: [guard('tab:settle')] }, handleSettleTab);

  // 5. Transfer & Merge Tabs (P1)
  const handleTransferTab = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = transferTabParamsSchema.parse(req.params);
    const body = transferTabRequestSchema.parse(req.body);
    return Bar.transferTab(id, body, user);
  };
  app.post('/tabs/:id/transfer', { preHandler: [guard('tab:update')] }, handleTransferTab);

  const handleMergeTab = async (req: FastifyRequest) => {
    const user = (req as any).user as SessionUser | undefined;
    const { id } = mergeTabParamsSchema.parse(req.params);
    const body = mergeTabRequestSchema.parse(req.body);
    return Bar.mergeTab(id, body.targetTabId, user);
  };
  app.post('/tabs/:id/merge', { preHandler: [guard('tab:update')] }, handleMergeTab);

  // 6. KDS Screen
  const handleGetKds = async (req: FastifyRequest) => {
    const { station, history } = getKdsQuerySchema.parse(req.query);
    return Bar.getKds(station, history);
  };
  app.get('/kds', { preHandler: [guard('kds:read')] }, handleGetKds);

  // 7. Z-Report
  const handleGetZReport = async (req: FastifyRequest) => {
    const { date } = getZReportQuerySchema.parse(req.query);
    return Bar.getZReport(date);
  };
  app.get('/reports/z', { preHandler: [guard('report:read')] }, handleGetZReport);
}
