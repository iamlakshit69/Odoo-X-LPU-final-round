// Owner: Dev A – Phase 8: CRM Service
import { randomUUID } from 'node:crypto';
import { eq, and, desc, lt, inArray, count } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import {
  leads,
  leadActivities,
  leadTasks,
  quotes,
  quoteLines,
} from '../../db/schema/crm.js';
import { users, roles } from '../../db/schema/core.js';
import {
  Lead,
  LeadDetail,
  LeadActivity,
  LeadTask,
  Quote,
  QuoteLine,
  CreatePublicEnquiryRequest,
  CreatePublicTrialBookingRequest,
  ConvertLeadResponse,
  PlanCode,
} from '@club/contract';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';
import { Notifications } from '../../core/notifications.js';
import { Settings } from '../../core/settings.js';
import { clubLocalToday, addClubDays } from '../../core/clubTime.js';
import { Members } from '../members/index.js';
import { Bookings } from '../bookings/index.js';

export class CrmService {
  /**
   * Helper for round-robin assignment among active front_desk users.
   * Finds the active user with role 'front_desk' having the least assigned leads.
   */
  async getNextFrontDeskAssignee(): Promise<string | null> {
    try {
      const frontDeskUsers = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(roles.code, 'front_desk'), eq(users.active, true)));

      if (frontDeskUsers.length === 0) {
        return null;
      }

      // Find user with fewest assigned leads
      const userIds = frontDeskUsers.map((u) => u.id);
      const leadCounts = await db
        .select({
          assignedTo: leads.assignedTo,
          leadCount: count(),
        })
        .from(leads)
        .where(inArray(leads.assignedTo, userIds))
        .groupBy(leads.assignedTo);

      const countMap = new Map<string, number>();
      for (const u of userIds) {
        countMap.set(u, 0);
      }
      for (const row of leadCounts) {
        if (row.assignedTo) {
          countMap.set(row.assignedTo, row.leadCount);
        }
      }

      // Pick user with lowest count
      let selectedId = userIds[0];
      let lowestCount = countMap.get(selectedId) ?? 0;
      for (const u of userIds) {
        const c = countMap.get(u) ?? 0;
        if (c < lowestCount) {
          selectedId = u;
          lowestCount = c;
        }
      }

      return selectedId;
    } catch {
      return null;
    }
  }

  /**
   * 1. Public enquiry submission (web_form)
   * Response contains ONLY leadId and message (NO personal data).
   */
  async createEnquiry(
    input: CreatePublicEnquiryRequest
  ): Promise<{ leadId: string; message: string }> {
    const leadId = randomUUID();
    const assignedTo = await this.getNextFrontDeskAssignee();
    const now = new Date();

    const [newLead] = await db
      .insert(leads)
      .values({
        id: leadId,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        source: 'web_form',
        interest: input.interest || null,
        stage: 'new',
        assignedTo,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Ledger: record initial enquiry activity
    await db.insert(leadActivities).values({
      id: randomUUID(),
      leadId: newLead.id,
      type: 'stage_change',
      body: 'Lead created via web_form. Stage: new',
      byUserId: null,
      at: now,
      createdAt: now,
    });

    if (input.message) {
      await db.insert(leadActivities).values({
        id: randomUUID(),
        leadId: newLead.id,
        type: 'message',
        body: input.message,
        byUserId: null,
        at: now,
        createdAt: now,
      });
    }

    // In-app notification to staff (front_desk and manager)
    await Notifications.notifyRoles(['front_desk', 'manager'], {
      template: 'lead.new',
      channel: ['inapp'],
      data: {
        name: input.name,
        phone: input.phone,
        leadId: newLead.id,
      },
    });

    // Publish realtime SSE event
    Events.publish('lead.created', { leadId: newLead.id });

    // Audit log
    await Audit.log({
      actor: 'system',
      action: 'lead.create',
      resource: 'lead',
      recordId: newLead.id,
      after: {
        source: 'web_form',
        stage: 'new',
        assignedTo,
      },
    });

    return {
      leadId: newLead.id,
      message: 'Enquiry received successfully',
    };
  }

  /**
   * 2. Public trial booking (P1)
   */
  async createTrialBooking(
    input: CreatePublicTrialBookingRequest
  ): Promise<{ leadId: string; bookingId: string; message: string }> {
    // 1. Create booking as guest via BookingsService
    const bookingRes = await Bookings.createBooking({
      courtId: input.courtId,
      startAt: typeof input.startAt === 'string' ? input.startAt : (input.startAt as Date).toISOString(),
      channel: 'public',
      guest: {
        name: input.name,
        phone: input.phone,
      },
    });

    const leadId = randomUUID();
    const assignedTo = await this.getNextFrontDeskAssignee();
    const now = new Date();

    const [newLead] = await db
      .insert(leads)
      .values({
        id: leadId,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        source: 'trial_booking',
        stage: 'new',
        assignedTo,
        trialBookingId: bookingRes.booking.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(leadActivities).values({
      id: randomUUID(),
      leadId: newLead.id,
      type: 'stage_change',
      body: `Trial booking scheduled on court for ${String(input.startAt)}. Stage: new`,
      byUserId: null,
      at: now,
      createdAt: now,
    });

    // Notify staff
    await Notifications.notifyRoles(['front_desk', 'manager'], {
      template: 'lead.new',
      channel: ['inapp'],
      data: {
        name: input.name,
        phone: input.phone,
        leadId: newLead.id,
      },
    });

    Events.publish('lead.created', { leadId: newLead.id });

    await Audit.log({
      actor: 'system',
      action: 'lead.trial_booking',
      resource: 'lead',
      recordId: newLead.id,
      after: {
        trialBookingId: bookingRes.booking.id,
        source: 'trial_booking',
      },
    });

    return {
      leadId: newLead.id,
      bookingId: bookingRes.booking.id,
      message: 'Trial booking created successfully',
    };
  }

  /**
   * 3. List leads with filters and pagination
   */
  async listLeads(query: {
    stage?: string;
    assignedTo?: string;
    source?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Lead[]; nextCursor?: string; total: number }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const conditions = [];

    if (query.stage) {
      conditions.push(eq(leads.stage, query.stage));
    }
    if (query.assignedTo) {
      conditions.push(eq(leads.assignedTo, query.assignedTo));
    }
    if (query.source) {
      conditions.push(eq(leads.source, query.source));
    }
    if (query.cursor) {
      conditions.push(lt(leads.createdAt, new Date(query.cursor)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        lead: leads,
        assignedUserName: users.name,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const items: Lead[] = slice.map(({ lead, assignedUserName }) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source as any,
      interest: lead.interest,
      stage: lead.stage,
      assignedTo: lead.assignedTo,
      assignedToName: assignedUserName || undefined,
      lostReason: lead.lostReason,
      convertedMemberId: lead.convertedMemberId,
      trialBookingId: lead.trialBookingId,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    }));

    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].lead.createdAt.toISOString() : undefined;

    return {
      items,
      nextCursor,
      total: items.length,
    };
  }

  /**
   * 4. Get lead detail with timeline (activities, tasks, quotes)
   */
  async getLead(id: string): Promise<LeadDetail> {
    const [row] = await db
      .select({
        lead: leads,
        assignedUserName: users.name,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(eq(leads.id, id))
      .limit(1);

    if (!row) {
      throw new AppError('NOT_FOUND', `Lead '${id}' not found`, 404);
    }

    const { lead, assignedUserName } = row;

    // Load activities
    const actRows = await db
      .select({
        act: leadActivities,
        userName: users.name,
      })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.byUserId, users.id))
      .where(eq(leadActivities.leadId, id))
      .orderBy(desc(leadActivities.at));

    const activities: LeadActivity[] = actRows.map(({ act, userName }) => ({
      id: act.id,
      leadId: act.leadId,
      type: act.type as any,
      body: act.body,
      byUserId: act.byUserId,
      byUserName: userName || undefined,
      at: act.at.toISOString(),
    }));

    // Load tasks
    const taskRows = await db
      .select({
        task: leadTasks,
        userName: users.name,
      })
      .from(leadTasks)
      .leftJoin(users, eq(leadTasks.assignedTo, users.id))
      .where(eq(leadTasks.leadId, id))
      .orderBy(desc(leadTasks.createdAt));

    const tasks: LeadTask[] = taskRows.map(({ task, userName }) => ({
      id: task.id,
      leadId: task.leadId,
      title: task.title,
      dueOn: task.dueOn,
      doneAt: task.doneAt ? task.doneAt.toISOString() : null,
      assignedTo: task.assignedTo,
      assignedToName: userName || undefined,
      createdAt: task.createdAt.toISOString(),
    }));

    // Load quotes with lines
    const quoteRows = await db
      .select()
      .from(quotes)
      .where(eq(quotes.leadId, id))
      .orderBy(desc(quotes.createdAt));

    const quoteIds = quoteRows.map((q) => q.id);
    const linesMap = new Map<string, QuoteLine[]>();

    if (quoteIds.length > 0) {
      const lineRows = await db
        .select()
        .from(quoteLines)
        .where(inArray(quoteLines.quoteId, quoteIds));

      for (const l of lineRows) {
        const arr = linesMap.get(l.quoteId) || [];
        arr.push({
          id: l.id,
          quoteId: l.quoteId,
          description: l.description,
          qty: l.qty,
          unitPricePaise: l.unitPricePaise,
          totalPaise: l.qty * l.unitPricePaise,
        });
        linesMap.set(l.quoteId, arr);
      }
    }

    const quotesList: Quote[] = quoteRows.map((q) => ({
      id: q.id,
      leadId: q.leadId,
      number: q.number,
      status: q.status as any,
      validUntil: q.validUntil,
      totalPaise: q.totalPaise,
      lines: linesMap.get(q.id) || [],
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    }));

    return {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source as any,
      interest: lead.interest,
      stage: lead.stage,
      assignedTo: lead.assignedTo,
      assignedToName: assignedUserName || undefined,
      lostReason: lead.lostReason,
      convertedMemberId: lead.convertedMemberId,
      trialBookingId: lead.trialBookingId,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      activities,
      tasks,
      quotes: quotesList,
    };
  }

  /**
   * 5. Update lead (stage change, assignment, etc.)
   */
  async updateLead(
    id: string,
    input: {
      stage?: string;
      assignedTo?: string | null;
      lostReason?: string;
      interest?: string;
    },
    actorId?: string
  ): Promise<Lead> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    if (!lead) {
      throw new AppError('NOT_FOUND', `Lead '${id}' not found`, 404);
    }

    const validStages =
      (await Settings.get<string[]>('crm.stages')) || [
        'new',
        'contacted',
        'quotation_sent',
        'follow_up',
        'converted',
        'lost',
      ];

    if (input.stage && !validStages.includes(input.stage)) {
      throw new AppError(
        'VALIDATION',
        `Invalid stage '${input.stage}'. Must be one of: ${validStages.join(', ')}`,
        400
      );
    }

    // 'lost' requires lostReason
    if (input.stage === 'lost') {
      const reason = input.lostReason ?? lead.lostReason;
      if (!reason || reason.trim().length === 0) {
        throw new AppError('VALIDATION', 'lostReason is required when moving lead to lost', 400);
      }
    }

    const now = new Date();
    const updateData: any = { updatedAt: now };

    if (input.stage !== undefined) updateData.stage = input.stage;
    if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
    if (input.lostReason !== undefined) updateData.lostReason = input.lostReason;
    if (input.interest !== undefined) updateData.interest = input.interest;

    const [updated] = await db
      .update(leads)
      .set(updateData)
      .where(eq(leads.id, id))
      .returning();

    // Activities
    if (input.stage && input.stage !== lead.stage) {
      await db.insert(leadActivities).values({
        id: randomUUID(),
        leadId: id,
        type: 'stage_change',
        body: `Stage changed from ${lead.stage} to ${input.stage}${
          input.stage === 'lost' ? ` (Reason: ${input.lostReason || lead.lostReason})` : ''
        }`,
        byUserId: actorId || null,
        at: now,
        createdAt: now,
      });

      // Auto-task on 'follow_up': due in 2 days
      if (input.stage === 'follow_up') {
        const today = clubLocalToday();
        const dueOn = addClubDays(today, 2);
        await db.insert(leadTasks).values({
          id: randomUUID(),
          leadId: id,
          title: `Follow-up with ${lead.name}`,
          dueOn,
          assignedTo: updated.assignedTo || null,
          createdAt: now,
        });

        await db.insert(leadActivities).values({
          id: randomUUID(),
          leadId: id,
          type: 'note',
          body: `Auto-generated follow-up task due on ${dueOn}`,
          byUserId: actorId || null,
          at: now,
          createdAt: now,
        });
      }
    }

    if (input.assignedTo !== undefined && input.assignedTo !== lead.assignedTo) {
      await db.insert(leadActivities).values({
        id: randomUUID(),
        leadId: id,
        type: 'note',
        body: input.assignedTo ? `Lead assigned to user ${input.assignedTo}` : 'Lead unassigned',
        byUserId: actorId || null,
        at: now,
        createdAt: now,
      });
    }

    await Audit.log({
      actor: actorId || 'system',
      action: 'lead.update',
      resource: 'lead',
      recordId: id,
      before: { stage: lead.stage, assignedTo: lead.assignedTo },
      after: { stage: updated.stage, assignedTo: updated.assignedTo },
    });

    return {
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      source: updated.source as any,
      interest: updated.interest,
      stage: updated.stage,
      assignedTo: updated.assignedTo,
      lostReason: updated.lostReason,
      convertedMemberId: updated.convertedMemberId,
      trialBookingId: updated.trialBookingId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * 6. Add note to lead
   */
  async addNote(id: string, body: string, actorId?: string): Promise<LeadActivity> {
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, id)).limit(1);
    if (!lead) {
      throw new AppError('NOT_FOUND', `Lead '${id}' not found`, 404);
    }

    const now = new Date();
    const [act] = await db
      .insert(leadActivities)
      .values({
        id: randomUUID(),
        leadId: id,
        type: 'note',
        body,
        byUserId: actorId || null,
        at: now,
        createdAt: now,
      })
      .returning();

    await Audit.log({
      actor: actorId || 'system',
      action: 'lead.note',
      resource: 'lead_activity',
      recordId: act.id,
      after: { leadId: id, body },
    });

    return {
      id: act.id,
      leadId: act.leadId,
      type: 'note',
      body: act.body,
      byUserId: act.byUserId,
      at: act.at.toISOString(),
    };
  }

  /**
   * 7. Add task to lead
   */
  async addTask(
    id: string,
    input: { title: string; dueOn: string; assignedTo?: string },
    actorId?: string
  ): Promise<LeadTask> {
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, id)).limit(1);
    if (!lead) {
      throw new AppError('NOT_FOUND', `Lead '${id}' not found`, 404);
    }

    const now = new Date();
    const [task] = await db
      .insert(leadTasks)
      .values({
        id: randomUUID(),
        leadId: id,
        title: input.title,
        dueOn: input.dueOn,
        assignedTo: input.assignedTo || null,
        createdAt: now,
      })
      .returning();

    await db.insert(leadActivities).values({
      id: randomUUID(),
      leadId: id,
      type: 'note',
      body: `Task created: ${input.title} (Due: ${input.dueOn})`,
      byUserId: actorId || null,
      at: now,
      createdAt: now,
    });

    return {
      id: task.id,
      leadId: task.leadId,
      title: task.title,
      dueOn: task.dueOn,
      doneAt: null,
      assignedTo: task.assignedTo,
      createdAt: task.createdAt.toISOString(),
    };
  }

  /**
   * 8. Update task completion status
   */
  async updateTask(
    taskId: string,
    input: { done: boolean },
    actorId?: string
  ): Promise<LeadTask> {
    const [task] = await db
      .select()
      .from(leadTasks)
      .where(eq(leadTasks.id, taskId))
      .limit(1);

    if (!task) {
      throw new AppError('NOT_FOUND', `Task '${taskId}' not found`, 404);
    }

    const now = new Date();
    const doneAt = input.done ? now : null;

    const [updated] = await db
      .update(leadTasks)
      .set({ doneAt })
      .where(eq(leadTasks.id, taskId))
      .returning();

    await db.insert(leadActivities).values({
      id: randomUUID(),
      leadId: task.leadId,
      type: 'task_done',
      body: `Task '${task.title}' marked ${input.done ? 'completed' : 'pending'}`,
      byUserId: actorId || null,
      at: now,
      createdAt: now,
    });

    return {
      id: updated.id,
      leadId: updated.leadId,
      title: updated.title,
      dueOn: updated.dueOn,
      doneAt: updated.doneAt ? updated.doneAt.toISOString() : null,
      assignedTo: updated.assignedTo,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * 9. Create quote for lead
   */
  async createQuote(
    leadId: string,
    input: {
      lines: Array<{ description: string; qty: number; unitPricePaise: number }>;
      validUntil?: string;
    },
    actorId?: string
  ): Promise<Quote> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) {
      throw new AppError('NOT_FOUND', `Lead '${leadId}' not found`, 404);
    }

    const [countRes] = await db.select({ c: count() }).from(quotes);
    const seq = (countRes?.c ?? 0) + 1;
    const year = new Date().getFullYear();
    const number = `QTE-${year}-${String(seq).padStart(5, '0')}`;

    const totalPaise = input.lines.reduce(
      (sum, line) => sum + line.qty * line.unitPricePaise,
      0
    );

    const quoteId = randomUUID();
    const now = new Date();

    const [newQuote] = await db
      .insert(quotes)
      .values({
        id: quoteId,
        leadId,
        number,
        status: 'draft',
        validUntil: input.validUntil || null,
        totalPaise,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const createdLines: QuoteLine[] = [];
    for (const line of input.lines) {
      const [ql] = await db
        .insert(quoteLines)
        .values({
          id: randomUUID(),
          quoteId,
          description: line.description,
          qty: line.qty,
          unitPricePaise: line.unitPricePaise,
          createdAt: now,
        })
        .returning();

      createdLines.push({
        id: ql.id,
        quoteId: ql.quoteId,
        description: ql.description,
        qty: ql.qty,
        unitPricePaise: ql.unitPricePaise,
        totalPaise: ql.qty * ql.unitPricePaise,
      });
    }

    await db.insert(leadActivities).values({
      id: randomUUID(),
      leadId,
      type: 'quote',
      body: `Quote ${number} created for ${totalPaise} paise (${createdLines.length} line items)`,
      byUserId: actorId || null,
      at: now,
      createdAt: now,
    });

    await Audit.log({
      actor: actorId || 'system',
      action: 'quote.create',
      resource: 'quote',
      recordId: quoteId,
      after: { number, totalPaise, lineCount: createdLines.length },
    });

    return {
      id: newQuote.id,
      leadId: newQuote.leadId,
      number: newQuote.number,
      status: 'draft',
      validUntil: newQuote.validUntil,
      totalPaise: newQuote.totalPaise,
      lines: createdLines,
      createdAt: newQuote.createdAt.toISOString(),
      updatedAt: newQuote.updatedAt.toISOString(),
    };
  }

  /**
   * 10. Send quote (email stub via Notifications, update status, stage to quotation_sent)
   */
  async sendQuote(
    quoteId: string,
    actorId?: string
  ): Promise<{ success: boolean; quote: Quote; message: string }> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!quote) {
      throw new AppError('NOT_FOUND', `Quote '${quoteId}' not found`, 404);
    }

    if (quote.status !== 'draft') {
      throw new AppError('INVALID_STATE', `Only draft quotes can be sent. Current status: ${quote.status}`, 409);
    }

    const [lead] = await db.select().from(leads).where(eq(leads.id, quote.leadId)).limit(1);
    if (!lead) {
      throw new AppError('NOT_FOUND', `Lead for quote not found`, 404);
    }

    const now = new Date();
    const [updatedQuote] = await db
      .update(quotes)
      .set({ status: 'sent', updatedAt: now })
      .where(eq(quotes.id, quoteId))
      .returning();

    // Move lead stage to quotation_sent
    await db
      .update(leads)
      .set({ stage: 'quotation_sent', updatedAt: now })
      .where(eq(leads.id, lead.id));

    // Ledger activity
    await db.insert(leadActivities).values({
      id: randomUUID(),
      leadId: lead.id,
      type: 'stage_change',
      body: `Quote ${quote.number} sent to customer (${lead.email || lead.phone}). Stage changed to quotation_sent`,
      byUserId: actorId || null,
      at: now,
      createdAt: now,
    });

    // Send email notification stub
    await Notifications.send({
      to: { leadId: lead.id },
      template: 'quote.sent',
      channel: ['email'],
      data: {
        quoteNumber: quote.number,
        quoteId: quote.id,
        customerName: lead.name,
        totalPaise: quote.totalPaise,
      },
    });

    await Audit.log({
      actor: actorId || 'system',
      action: 'quote.send',
      resource: 'quote',
      recordId: quoteId,
      after: { status: 'sent', stage: 'quotation_sent' },
    });

    // Load lines for return
    const lineRows = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId));

    const lines: QuoteLine[] = lineRows.map((l) => ({
      id: l.id,
      quoteId: l.quoteId,
      description: l.description,
      qty: l.qty,
      unitPricePaise: l.unitPricePaise,
      totalPaise: l.qty * l.unitPricePaise,
    }));

    return {
      success: true,
      quote: {
        id: updatedQuote.id,
        leadId: updatedQuote.leadId,
        number: updatedQuote.number,
        status: updatedQuote.status as any,
        validUntil: updatedQuote.validUntil,
        totalPaise: updatedQuote.totalPaise,
        lines,
        createdAt: updatedQuote.createdAt.toISOString(),
        updatedAt: updatedQuote.updatedAt.toISOString(),
      },
      message: 'Quote sent successfully',
    };
  }

  /**
   * 11. Convert lead to member in ONE atomic transaction
   */
  async convertLead(
    leadId: string,
    input: {
      planCode: PlanCode;
      dob?: string;
      photoUrl?: string;
      notes?: string;
    },
    actorId?: string
  ): Promise<ConvertLeadResponse> {
    return db.transaction(async (tx) => {
      // 1. Fetch lead with row lock
      const [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .for('update')
        .limit(1);

      if (!lead) {
        throw new AppError('NOT_FOUND', `Lead '${leadId}' not found`, 404);
      }

      if (lead.stage === 'converted' || lead.convertedMemberId) {
        throw new AppError(
          'INVALID_STATE',
          `Lead is already converted (memberId: ${lead.convertedMemberId})`,
          409
        );
      }

      // 2. Create member + membership + invoice via MembersService (reusing logic, in tx)
      const memberResult = await Members.createMember(
        {
          fullName: lead.name,
          phone: lead.phone,
          email: lead.email || undefined,
          planCode: input.planCode,
          dob: input.dob,
          photoUrl: input.photoUrl,
          notes: input.notes,
        },
        actorId,
        tx
      );

      const now = new Date();

      // 3. Update lead to converted
      await tx
        .update(leads)
        .set({
          stage: 'converted',
          convertedMemberId: memberResult.member.id,
          updatedAt: now,
        })
        .where(eq(leads.id, leadId));

      // 4. Ledger: record activity
      await tx.insert(leadActivities).values({
        id: randomUUID(),
        leadId,
        type: 'stage_change',
        body: `Lead converted to member ${memberResult.member.memberCode} on plan ${input.planCode}. Stage: converted`,
        byUserId: actorId || null,
        at: now,
        createdAt: now,
      });

      // 5. Audit
      await Audit.log({
        actor: actorId || 'system',
        action: 'lead.convert',
        resource: 'lead',
        recordId: leadId,
        after: {
          convertedMemberId: memberResult.member.id,
          memberCode: memberResult.member.memberCode,
          stage: 'converted',
        },
      });

      return {
        memberId: memberResult.member.id,
        memberCode: memberResult.member.memberCode,
        membershipId: memberResult.membership.id,
        invoiceId: memberResult.invoiceId,
      };
    });
  }
}

export const Crm = new CrmService();
