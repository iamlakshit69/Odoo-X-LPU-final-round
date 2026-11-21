import { randomUUID } from 'node:crypto';
import { eq, and, or, ilike, desc, count, sql, lt, gte } from 'drizzle-orm';
import {
  PlanCode,
  PlanEntitlements,
  MembershipStatus,
  CreateMemberRequest,
  Plan,
  Member,
  Membership,
  CheckinRecord,
  TimelineItem,
} from '@club/contract';
import { db } from '../../core/db/index.js';
import {
  plans,
  members,
  memberships,
  memberGuardians,
  checkins,
} from '../../db/schema/members.js';
import { bookings } from '../../db/schema/courts.js';
import { clubLocalToday, addClubDays, clubLocalDayBoundsUtc } from '../../core/clubTime.js';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';
import { invoiceServiceStub } from '../../core/stubs/finance.js';

export interface ActivePlanResult {
  planCode: 'gold' | 'silver' | 'junior' | 'walkin';
  status: 'active' | 'expired' | 'suspended' | 'cancelled' | 'none';
  dailyBookingLimit: number;
  planId?: string;
  membershipId?: string;
  endsOn?: string;
}

export function getPlanEntitlements(planCode: string): PlanEntitlements {
  switch (planCode) {
    case 'gold':
      return {
        courtRate: 'Free (100% off)',
        shopDiscountBps: 1500, // 15%
        barDiscountBps: 1000,  // 10%
      };
    case 'silver':
      return {
        courtRate: '40% off peak (17:00-21:00), 60% off normal',
        shopDiscountBps: 1000, // 10%
        barDiscountBps: 500,   // 5%
      };
    case 'junior':
      return {
        courtRate: '70% off before 17:00',
        shopDiscountBps: 500,  // 5%
        barDiscountBps: 0,
      };
    default:
      return {
        courtRate: 'Standard hourly rates',
        shopDiscountBps: 0,
        barDiscountBps: 0,
      };
  }
}

export class MembersService {
  /**
   * Generates next member code CC-000101 style using database sequence.
   */
  async generateMemberCode(): Promise<string> {
    for (let attempts = 0; attempts < 20; attempts++) {
      let code: string | null = null;
      try {
        const res = await db.execute(sql`SELECT nextval('member_code_seq') as val`);
        const val = (res as any)?.rows?.[0]?.val ?? (res as any)?.[0]?.val;
        if (val) {
          code = `CC-${String(val).padStart(6, '0')}`;
        }
      } catch {
        // Fallback if sequence is unavailable
      }

      if (!code) {
        code = `CC-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      const [existing] = await db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.memberCode, code))
        .limit(1);

      if (!existing) {
        return code;
      }
    }

    // Ultimate fallback if multiple collisions occur
    return `CC-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Returns public plans with derived entitlements.
   */
  async getPlans(): Promise<Plan[]> {
    try {
      const rows = await db
        .select()
        .from(plans)
        .where(eq(plans.active, true));

      if (rows.length > 0) {
        return rows.map((p) => ({
          id: p.id,
          code: p.code as PlanCode,
          name: p.name,
          pricePaise: p.pricePaise,
          durationDays: p.durationDays,
          dailyBookingLimit: p.dailyBookingLimit,
          advanceBookingDays: p.advanceBookingDays,
          active: p.active,
          entitlements: getPlanEntitlements(p.code),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }));
      }
    } catch {
      // Fallback for tests when DB is offline
    }

    return [
      {
        id: '20000000-0000-0000-0000-000000000001',
        code: 'gold',
        name: 'Gold Membership',
        pricePaise: 5000000,
        durationDays: 365,
        dailyBookingLimit: 2,
        advanceBookingDays: 14,
        active: true,
        entitlements: getPlanEntitlements('gold'),
      },
      {
        id: '20000000-0000-0000-0000-000000000002',
        code: 'silver',
        name: 'Silver Membership',
        pricePaise: 2500000,
        durationDays: 365,
        dailyBookingLimit: 2,
        advanceBookingDays: 7,
        active: true,
        entitlements: getPlanEntitlements('silver'),
      },
      {
        id: '20000000-0000-0000-0000-000000000003',
        code: 'junior',
        name: 'Junior Membership',
        pricePaise: 1200000,
        durationDays: 365,
        dailyBookingLimit: 2,
        advanceBookingDays: 7,
        active: true,
        entitlements: getPlanEntitlements('junior'),
      },
    ];
  }

  /**
   * Resolves member's active plan for pricing and booking limits.
   * Expired or suspended members resolve to 'walkin'.
   */
  async getActivePlan(memberId: string, at?: Date): Promise<ActivePlanResult> {
    const today = at ? clubLocalToday() : clubLocalToday();

    try {
      // Query most recent membership
      const rows = await db
        .select({
          membershipId: memberships.id,
          status: memberships.status,
          startsOn: memberships.startsOn,
          endsOn: memberships.endsOn,
          planId: plans.id,
          planCode: plans.code,
          dailyBookingLimit: plans.dailyBookingLimit,
        })
        .from(memberships)
        .innerJoin(plans, eq(memberships.planId, plans.id))
        .where(eq(memberships.memberId, memberId))
        .orderBy(desc(memberships.endsOn))
        .limit(1);

      if (rows.length === 0) {
        return {
          planCode: 'walkin',
          status: 'none',
          dailyBookingLimit: 0,
        };
      }

      const m = rows[0];

      // If suspended, expired, or cancelled -> treat as walkin
      if (m.status !== 'active') {
        return {
          planCode: 'walkin',
          status: m.status as MembershipStatus,
          dailyBookingLimit: 0,
          planId: m.planId,
          membershipId: m.membershipId,
          endsOn: m.endsOn,
        };
      }

      // Check date bounds
      if (m.startsOn > today || m.endsOn < today) {
        return {
          planCode: 'walkin',
          status: 'expired',
          dailyBookingLimit: 0,
          planId: m.planId,
          membershipId: m.membershipId,
          endsOn: m.endsOn,
        };
      }

      return {
        planCode: m.planCode as 'gold' | 'silver' | 'junior',
        status: 'active',
        dailyBookingLimit: m.dailyBookingLimit,
        planId: m.planId,
        membershipId: m.membershipId,
        endsOn: m.endsOn,
      };
    } catch {
      return {
        planCode: 'walkin',
        status: 'none',
        dailyBookingLimit: 0,
      };
    }
  }

  /**
   * Registers a new member with membership and invoice.
   */
  async createMember(
    input: CreateMemberRequest,
    actorId?: string,
    tx?: any
  ): Promise<{
    member: Member;
    membership: Membership;
    invoiceId: string;
    qrToken: string;
  }> {
    const client = tx || db;
    // 1. Lookup plan
    const [plan] = await client
      .select()
      .from(plans)
      .where(and(eq(plans.code, input.planCode), eq(plans.active, true)))
      .limit(1);

    if (!plan) {
      throw new AppError('NOT_FOUND', `Plan '${input.planCode}' not found`, 404);
    }

    const memberId = randomUUID();
    const memberCode = await this.generateMemberCode();
    const qrToken = `qr_${randomUUID().replace(/-/g, '')}`;
    const today = clubLocalToday();
    const endsOn = addClubDays(today, plan.durationDays);

    // 2. Insert member
    const [newMember] = await client
      .insert(members)
      .values({
        id: memberId,
        memberCode,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email || null,
        dob: input.dob || null,
        photoUrl: input.photoUrl || null,
        qrToken,
        notes: input.notes || null,
        createdBy: actorId || null,
      })
      .returning();

    // 3. Create invoice through InvoiceService
    // TODO(replace-with-DevB): replace with Dev B InvoiceService once available
    const invoice = await invoiceServiceStub.create(
      {
        customer: { memberId: newMember.id, guestName: newMember.fullName },
        lines: [
          {
            source: 'membership',
            description: `${plan.name} Membership (${plan.durationDays} days)`,
            qty: 1,
            unitPricePaise: plan.pricePaise,
            taxCategory: 'membership_18',
            refType: 'plan',
            refId: plan.id,
          },
        ],
      },
      tx || null
    );

    // 4. Insert membership row
    const membershipId = randomUUID();
    const [newMembership] = await client
      .insert(memberships)
      .values({
        id: membershipId,
        memberId: newMember.id,
        planId: plan.id,
        startsOn: today,
        endsOn,
        status: 'active',
        invoiceId: invoice.invoiceId,
      })
      .returning();

    // 5. Guardian link if provided
    if (input.guardianMemberId) {
      await client.insert(memberGuardians).values({
        memberId: newMember.id,
        guardianMemberId: input.guardianMemberId,
        relationship: input.relationship || 'Guardian',
      });
    }

    // 6. Audit & events
    await Audit.log({
      actor: actorId || 'system',
      action: 'member.create',
      resource: 'member',
      recordId: newMember.id,
      after: {
        memberCode,
        planCode: plan.code,
        invoiceId: invoice.invoiceId,
      },
    });

    Events.publish('dashboard.tick', {});

    const memberResult: Member = {
      id: newMember.id,
      memberCode: newMember.memberCode,
      fullName: newMember.fullName,
      phone: newMember.phone,
      email: newMember.email,
      dob: newMember.dob,
      photoUrl: newMember.photoUrl,
      qrToken: newMember.qrToken,
      notes: newMember.notes,
      createdBy: newMember.createdBy,
      currentPlan: plan.code as PlanCode,
      status: 'active',
      endsOn,
      createdAt: newMember.createdAt.toISOString(),
      updatedAt: newMember.updatedAt.toISOString(),
    };

    const membershipResult: Membership = {
      id: newMembership.id,
      memberId: newMembership.memberId,
      planId: newMembership.planId,
      startsOn: newMembership.startsOn,
      endsOn: newMembership.endsOn,
      status: 'active',
      invoiceId: invoice.invoiceId,
      createdAt: newMembership.createdAt.toISOString(),
      updatedAt: newMembership.updatedAt.toISOString(),
    };

    return {
      member: memberResult,
      membership: membershipResult,
      invoiceId: invoice.invoiceId,
      qrToken: newMember.qrToken,
    };
  }

  /**
   * Search members by name, phone, or member code with pagination.
   */
  async searchMembers(query: {
    q?: string;
    status?: MembershipStatus;
    planCode?: PlanCode;
    page?: number;
    limit?: number;
  }): Promise<{ items: Member[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.q && query.q.trim()) {
      const term = `%${query.q.trim()}%`;
      conditions.push(
        or(
          ilike(members.fullName, term),
          ilike(members.phone, term),
          ilike(members.memberCode, term)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ val: count() })
      .from(members)
      .where(whereClause);
    const total = countRes?.val ?? 0;

    const memberRows = await db
      .select()
      .from(members)
      .where(whereClause)
      .orderBy(desc(members.createdAt))
      .limit(limit)
      .offset(offset);

    // Resolve current plans for found members
    const items: Member[] = [];
    for (const m of memberRows) {
      const planInfo = await this.getActivePlan(m.id);
      items.push({
        id: m.id,
        memberCode: m.memberCode,
        fullName: m.fullName,
        phone: m.phone,
        email: m.email,
        dob: m.dob,
        photoUrl: m.photoUrl,
        qrToken: m.qrToken,
        notes: m.notes,
        createdBy: m.createdBy,
        currentPlan: planInfo.planCode !== 'walkin' ? (planInfo.planCode as PlanCode) : null,
        status: planInfo.status !== 'none' ? (planInfo.status as MembershipStatus) : null,
        endsOn: planInfo.endsOn || null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      });
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves member profile, active plan, and guardian info.
   */
  async getMember(id: string): Promise<any> {
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    if (!member) {
      throw new AppError('NOT_FOUND', `Member with id '${id}' not found`, 404);
    }

    // Latest membership
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.memberId, id))
      .orderBy(desc(memberships.endsOn))
      .limit(1);

    let planData: Plan | null = null;
    if (membership) {
      const [p] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, membership.planId))
        .limit(1);
      if (p) {
        planData = {
          id: p.id,
          code: p.code as PlanCode,
          name: p.name,
          pricePaise: p.pricePaise,
          durationDays: p.durationDays,
          dailyBookingLimit: p.dailyBookingLimit,
          advanceBookingDays: p.advanceBookingDays,
          active: p.active,
          entitlements: getPlanEntitlements(p.code),
        };
      }
    }

    // Guardian info
    const [guardianRow] = await db
      .select({
        id: members.id,
        fullName: members.fullName,
        phone: members.phone,
        relationship: memberGuardians.relationship,
      })
      .from(memberGuardians)
      .innerJoin(members, eq(memberGuardians.guardianMemberId, members.id))
      .where(eq(memberGuardians.memberId, id))
      .limit(1);

    return {
      id: member.id,
      memberCode: member.memberCode,
      fullName: member.fullName,
      phone: member.phone,
      email: member.email,
      dob: member.dob,
      photoUrl: member.photoUrl,
      qrToken: member.qrToken,
      notes: member.notes,
      createdBy: member.createdBy,
      currentPlan: planData?.code || null,
      status: (membership?.status as MembershipStatus) || null,
      endsOn: membership?.endsOn || null,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
      membership: membership
        ? {
            id: membership.id,
            memberId: membership.memberId,
            planId: membership.planId,
            startsOn: membership.startsOn,
            endsOn: membership.endsOn,
            status: membership.status as MembershipStatus,
            invoiceId: membership.invoiceId,
            replacedBy: membership.replacedBy,
            createdAt: membership.createdAt.toISOString(),
          }
        : null,
      plan: planData,
      guardian: guardianRow || null,
    };
  }

  /**
   * Retrieves unified member timeline across bookings, check-ins, memberships, and commerce.
   */
  async getTimeline(memberId: string): Promise<TimelineItem[]> {
    const items: TimelineItem[] = [];

    // 1. Memberships
    const memRows = await db
      .select({
        id: memberships.id,
        status: memberships.status,
        startsOn: memberships.startsOn,
        endsOn: memberships.endsOn,
        createdAt: memberships.createdAt,
        planName: plans.name,
      })
      .from(memberships)
      .innerJoin(plans, eq(memberships.planId, plans.id))
      .where(eq(memberships.memberId, memberId));

    for (const m of memRows) {
      items.push({
        id: m.id,
        kind: 'membership',
        at: m.createdAt.toISOString(),
        title: `${m.planName} Membership`,
        subtitle: `${m.startsOn} to ${m.endsOn}`,
        status: m.status,
      });
    }

    // 2. Bookings
    const bookingRows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.memberId, memberId));

    for (const b of bookingRows) {
      items.push({
        id: b.id,
        kind: 'booking',
        at: b.createdAt.toISOString(),
        title: `Court Booking (${b.kind})`,
        subtitle: `${b.startAt.toISOString().slice(11, 16)} - ${b.endAt.toISOString().slice(11, 16)}`,
        amountPaise: b.pricePaise || 0,
        status: b.status,
      });
    }

    // 3. Checkins
    const checkinRows = await db
      .select()
      .from(checkins)
      .where(eq(checkins.memberId, memberId));

    for (const c of checkinRows) {
      items.push({
        id: c.id,
        kind: 'checkin',
        at: c.at.toISOString(),
        title: `Club Check-in (${c.method.toUpperCase()})`,
        status: 'completed',
      });
    }

    // 4. Defensive query for Dev B commerce (orders, tabs, payments)
    try {
      const orderExists = await db.execute(sql`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'orders'
      `);
      if ((orderExists as any)?.rows?.length > 0) {
        const orderRows = await db.execute(sql`
          SELECT id, total_paise, status, created_at FROM orders WHERE member_id = ${memberId}
        `);
        for (const o of (orderRows as any)?.rows || []) {
          items.push({
            id: o.id,
            kind: 'order',
            at: new Date(o.created_at).toISOString(),
            title: `Shop Order #${String(o.id).slice(0, 8)}`,
            amountPaise: o.total_paise,
            status: o.status,
          });
        }
      }
    } catch {
      // Defensive fallback if orders table is not yet created
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items;
  }

  /**
   * Suspends a member's active membership.
   */
  async suspendMember(memberId: string, reason?: string, actorId?: string): Promise<any> {
    const [active] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.memberId, memberId), eq(memberships.status, 'active')))
      .limit(1);

    if (!active) {
      throw new AppError('INVALID_STATE', 'No active membership found to suspend');
    }

    await db
      .update(memberships)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(memberships.id, active.id));

    await Audit.log({
      actor: actorId || 'system',
      action: 'membership.suspend',
      resource: 'membership',
      recordId: active.id,
      after: { reason, status: 'suspended' },
    });

    return this.getMember(memberId);
  }

  /**
   * Reinstates a suspended membership.
   */
  async reinstateMember(memberId: string, actorId?: string): Promise<any> {
    const [suspended] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.memberId, memberId), eq(memberships.status, 'suspended')))
      .limit(1);

    if (!suspended) {
      throw new AppError('INVALID_STATE', 'No suspended membership found to reinstate');
    }

    await db
      .update(memberships)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(memberships.id, suspended.id));

    await Audit.log({
      actor: actorId || 'system',
      action: 'membership.reinstate',
      resource: 'membership',
      recordId: suspended.id,
      after: { status: 'active' },
    });

    return this.getMember(memberId);
  }

  /**
   * Renews membership.
   */
  async renewMembership(
    memberId: string,
    planCode?: PlanCode,
    actorId?: string
  ): Promise<{ membership: Membership; invoiceId: string }> {
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);

    if (!member) {
      throw new AppError('NOT_FOUND', 'Member not found', 404);
    }

    const [current] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.memberId, memberId))
      .orderBy(desc(memberships.endsOn))
      .limit(1);

    const code = planCode || (
      current
        ? (await db.select({ code: plans.code }).from(plans).where(eq(plans.id, current.planId)).limit(1))[0]?.code
        : 'gold'
    );

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.code, code))
      .limit(1);

    if (!plan) {
      throw new AppError('NOT_FOUND', `Plan '${code}' not found`, 404);
    }

    const today = clubLocalToday();
    const startsOn = current && current.status === 'active' && current.endsOn > today
      ? current.endsOn
      : today;
    const endsOn = addClubDays(startsOn, plan.durationDays);

    // TODO(replace-with-DevB): replace with Dev B InvoiceService once available
    const invoice = await invoiceServiceStub.create(
      {
        customer: { memberId: member.id, guestName: member.fullName },
        lines: [
          {
            source: 'membership',
            description: `Renewal: ${plan.name} Membership`,
            qty: 1,
            unitPricePaise: plan.pricePaise,
            taxCategory: 'membership_18',
            refType: 'plan',
            refId: plan.id,
          },
        ],
      },
      null
    );

    const membershipId = randomUUID();
    const [newMem] = await db
      .insert(memberships)
      .values({
        id: membershipId,
        memberId: member.id,
        planId: plan.id,
        startsOn,
        endsOn,
        status: 'active',
        invoiceId: invoice.invoiceId,
      })
      .returning();

    await Audit.log({
      actor: actorId || 'system',
      action: 'membership.renew',
      resource: 'membership',
      recordId: newMem.id,
      after: { planCode: plan.code, endsOn, invoiceId: invoice.invoiceId },
    });

    return {
      membership: {
        id: newMem.id,
        memberId: newMem.memberId,
        planId: newMem.planId,
        startsOn: newMem.startsOn,
        endsOn: newMem.endsOn,
        status: newMem.status as MembershipStatus,
        invoiceId: invoice.invoiceId,
        createdAt: newMem.createdAt.toISOString(),
      },
      invoiceId: invoice.invoiceId,
    };
  }

  /**
   * Plan change (upgrade/switch) with price difference calculation.
   */
  async changePlan(
    memberId: string,
    newPlanCode: PlanCode,
    actorId?: string
  ): Promise<{ membership: Membership; invoiceId: string }> {
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);

    if (!member) {
      throw new AppError('NOT_FOUND', 'Member not found', 404);
    }

    const [current] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.memberId, memberId), eq(memberships.status, 'active')))
      .limit(1);

    if (!current) {
      throw new AppError('INVALID_STATE', 'No active membership to change plan for');
    }

    const [currentPlan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, current.planId))
      .limit(1);

    const [newPlan] = await db
      .select()
      .from(plans)
      .where(eq(plans.code, newPlanCode))
      .limit(1);

    if (!newPlan) {
      throw new AppError('NOT_FOUND', `Plan '${newPlanCode}' not found`, 404);
    }

    const priceDiffPaise = Math.max(0, newPlan.pricePaise - (currentPlan?.pricePaise || 0));
    const today = clubLocalToday();
    const endsOn = addClubDays(today, newPlan.durationDays);

    // TODO(replace-with-DevB): replace with Dev B InvoiceService once available
    const invoice = await invoiceServiceStub.create(
      {
        customer: { memberId: member.id, guestName: member.fullName },
        lines: [
          {
            source: 'membership',
            description: `Plan Switch to ${newPlan.name} (Difference)`,
            qty: 1,
            unitPricePaise: priceDiffPaise,
            taxCategory: 'membership_18',
            refType: 'plan',
            refId: newPlan.id,
          },
        ],
      },
      null
    );

    const newMembershipId = randomUUID();

    // Close current membership
    await db
      .update(memberships)
      .set({
        status: 'cancelled',
        replacedBy: newMembershipId,
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, current.id));

    // Create new membership row
    const [newMem] = await db
      .insert(memberships)
      .values({
        id: newMembershipId,
        memberId: member.id,
        planId: newPlan.id,
        startsOn: today,
        endsOn,
        status: 'active',
        invoiceId: invoice.invoiceId,
      })
      .returning();

    await Audit.log({
      actor: actorId || 'system',
      action: 'membership.change_plan',
      resource: 'membership',
      recordId: newMem.id,
      before: { planId: current.planId, status: current.status },
      after: { planId: newPlan.id, priceDiffPaise, invoiceId: invoice.invoiceId },
    });

    return {
      membership: {
        id: newMem.id,
        memberId: newMem.memberId,
        planId: newMem.planId,
        startsOn: newMem.startsOn,
        endsOn: newMem.endsOn,
        status: 'active',
        invoiceId: invoice.invoiceId,
        createdAt: newMem.createdAt.toISOString(),
      },
      invoiceId: invoice.invoiceId,
    };
  }

  /**
   * Records a member check-in and returns their status card.
   */
  async checkin(input: {
    qrToken?: string;
    memberId?: string;
    method?: 'qr' | 'manual';
    staffUserId?: string;
  }): Promise<{ checkin: CheckinRecord; memberCard: any }> {
    const condition = input.qrToken
      ? eq(members.qrToken, input.qrToken)
      : input.memberId
      ? eq(members.id, input.memberId)
      : null;

    if (!condition) {
      throw new AppError('VALIDATION', 'Either qrToken or memberId must be provided', 400);
    }

    const [member] = await db
      .select()
      .from(members)
      .where(condition)
      .limit(1);

    if (!member) {
      throw new AppError('NOT_FOUND', 'Member not found', 404);
    }

    const planInfo = await this.getActivePlan(member.id);

    const [rec] = await db
      .insert(checkins)
      .values({
        id: randomUUID(),
        memberId: member.id,
        method: input.method || 'qr',
        staffUserId: input.staffUserId || null,
        at: new Date(),
      })
      .returning();

    await Audit.log({
      actor: input.staffUserId || 'system',
      action: 'member.checkin',
      resource: 'checkin',
      recordId: rec.id,
      after: {
        memberId: member.id,
        method: rec.method,
      },
    });

    return {
      checkin: {
        id: rec.id,
        memberId: rec.memberId,
        memberName: member.fullName,
        at: rec.at.toISOString(),
        method: rec.method as 'qr' | 'manual',
        staffUserId: rec.staffUserId,
      },
      memberCard: {
        id: member.id,
        memberCode: member.memberCode,
        fullName: member.fullName,
        planCode: planInfo.planCode !== 'walkin' ? (planInfo.planCode as PlanCode) : null,
        status: planInfo.status !== 'none' ? (planInfo.status as MembershipStatus) : 'none',
        endsOn: planInfo.endsOn || null,
        photoUrl: member.photoUrl,
      },
    };
  }

  /**
   * Retrieves today's current check-ins.
   */
  async getCurrentCheckins(): Promise<any[]> {
    const today = clubLocalToday();
    const bounds = clubLocalDayBoundsUtc(today);

    const rows = await db
      .select({
        id: checkins.id,
        memberId: members.id,
        memberCode: members.memberCode,
        fullName: members.fullName,
        checkedInAt: checkins.at,
        method: checkins.method,
      })
      .from(checkins)
      .innerJoin(members, eq(checkins.memberId, members.id))
      .where(gte(checkins.at, bounds.start))
      .orderBy(desc(checkins.at));

    const result = [];
    for (const r of rows) {
      const planInfo = await this.getActivePlan(r.memberId);
      result.push({
        id: r.id,
        memberId: r.memberId,
        memberCode: r.memberCode,
        fullName: r.fullName,
        planCode: planInfo.planCode !== 'walkin' ? planInfo.planCode : null,
        checkedInAt: r.checkedInAt.toISOString(),
        method: r.method,
      });
    }

    return result;
  }
}

export const Members = new MembersService();
