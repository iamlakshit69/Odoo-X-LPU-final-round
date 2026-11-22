import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  PublicSlot,
  StaffSlot,
  CourtWithPublicSlots,
  CourtWithStaffSlots,
  CourtType,
  Court,
  CreateBookingRequest,
  CreateBookingResponse,
  CancelBookingResponse,
  Booking,
  SocialSession,
  SocialSignup,
  QuoteRequest,
  QuoteResponse,
  Plan,
  Member,
  MemberDetail,
  TimelineItem,
  CreateMemberRequest,
  CreateMemberResponse,
  CheckinRequest,
  CheckinResponse,
  InvoiceDetail,
} from '@club/contract';

export class ApiClientError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : endpoint;
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = 'Request failed';
    let details: Record<string, unknown> | undefined;

    if (isJson && data?.error) {
      code = data.error.code || code;
      message = data.error.message || message;
      details = data.error.details;
    } else if (typeof data === 'string') {
      message = data;
    }

    throw new ApiClientError(res.status, code, message, details);
  }

  return data as T;
}

export const api = {
  auth: {
    login: (body: LoginRequest) =>
      request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    logout: () =>
      request<{ success: boolean }>('/api/auth/logout', {
        method: 'POST',
      }),
    me: () => request<MeResponse>('/api/me'),
  },

  courts: {
    getPublicAvailability: (date: string, courtType?: string) => {
      const q = new URLSearchParams({ date });
      if (courtType) q.set('courtType', courtType);
      return request<{ date: string; courts: CourtWithPublicSlots[] }>(
        `/api/public/availability?${q.toString()}`
      );
    },
    getStaffAvailability: (date: string, courtType?: string) => {
      const q = new URLSearchParams({ date });
      if (courtType) q.set('courtType', courtType);
      return request<{ date: string; courts: CourtWithStaffSlots[] }>(
        `/api/availability?${q.toString()}`
      );
    },
    listCourtTypes: () => request<CourtType[]>('/api/admin/court-types'),
    listCourts: () => request<Court[]>('/api/admin/courts'),
  },

  bookings: {
    create: (body: CreateBookingRequest) =>
      request<CreateBookingResponse>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    cancel: (id: string, body?: { reason?: string; overrideRefundPct?: number }) =>
      request<CancelBookingResponse>(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }),
    get: (id: string) => request<Booking>(`/api/bookings/${id}`),
    list: (params?: { date?: string; memberId?: string; courtId?: string }) => {
      const q = new URLSearchParams();
      if (params?.date) q.set('date', params.date);
      if (params?.memberId) q.set('memberId', params.memberId);
      if (params?.courtId) q.set('courtId', params.courtId);
      return request<{ items: Booking[]; nextCursor?: string | null }>(
        `/api/bookings?${q.toString()}`
      );
    },
    listSocialSessions: (date?: string) => {
      const q = new URLSearchParams();
      if (date) q.set('date', date);
      return request<SocialSession[]>(`/api/social/sessions?${q.toString()}`);
    },
    signupSocialSession: (sessionId: string, memberId: string) =>
      request<{ signup: SocialSignup; invoiceId?: string | null }>(
        `/api/social/sessions/${sessionId}/signup`,
        {
          method: 'POST',
          body: JSON.stringify({ memberId }),
        }
      ),
    cancelSocialSignup: (sessionId: string, memberId: string) =>
      request<{ success: boolean }>(`/api/social/sessions/${sessionId}/cancel-signup`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      }),
  },

  pricing: {
    quote: (body: QuoteRequest) =>
      request<QuoteResponse>('/api/pricing/quote', {
        method: 'POST',
        body: JSON.stringify({
          ...body,
          at: body.at instanceof Date ? body.at.toISOString() : body.at,
        }),
      }),
  },

  members: {
    listPlans: () => request<Plan[]>('/api/plans'),
    list: (params?: { q?: string; status?: string; planCode?: string; limit?: number; cursor?: string }) => {
      const q = new URLSearchParams();
      if (params?.q) q.set('q', params.q);
      if (params?.status) q.set('status', params.status);
      if (params?.planCode) q.set('planCode', params.planCode);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.cursor) q.set('cursor', params.cursor);
      return request<{ items: Member[]; nextCursor?: string | null }>(
        `/api/members?${q.toString()}`
      );
    },
    get: (id: string) => request<MemberDetail>(`/api/members/${id}`),
    getTimeline: (id: string) => request<TimelineItem[]>(`/api/members/${id}/timeline`),
    create: (body: CreateMemberRequest) =>
      request<CreateMemberResponse>('/api/members', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    renew: (id: string, planCode?: string) =>
      request<{ membership: unknown; invoiceId: string }>(`/api/members/${id}/renew`, {
        method: 'POST',
        body: JSON.stringify(planCode ? { planCode } : {}),
      }),
    checkin: (body: CheckinRequest) =>
      request<CheckinResponse>('/api/checkins', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getCurrentCheckins: () =>
      request<
        Array<{
          id: string;
          memberId: string;
          memberCode: string;
          fullName: string;
          planCode?: string | null;
          checkedInAt: string;
          method: 'qr' | 'manual';
        }>
      >('/api/checkins/current'),
  },

  invoices: {
    get: (id: string) => request<InvoiceDetail>(`/api/invoices/${id}`),
    recordPayment: (
      id: string,
      body: {
        method: 'cash' | 'card' | 'upi' | 'online' | 'comp';
        amountPaise: number;
        reference?: string;
      }
    ) =>
      request<{
        paymentId: string;
        invoiceId: string;
        amountPaise: number;
        outstandingPaise: number;
        status: string;
      }>(`/api/invoices/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  shop: {
    getProducts: (params?: { category?: string; active?: boolean }) => {
      const q = new URLSearchParams();
      if (params?.category) q.set('category', params.category);
      if (params?.active !== undefined) q.set('active', String(params.active));
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/products?${q.toString()}`);
    },
    getPublicProducts: (params?: { category?: string }) => {
      const q = new URLSearchParams();
      if (params?.category) q.set('category', params.category);
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/public/products?${q.toString()}`);
    },
    getStock: (params?: { lowOnly?: boolean }) => {
      const q = new URLSearchParams();
      if (params?.lowOnly !== undefined) q.set('lowOnly', String(params.lowOnly));
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/stock?${q.toString()}`);
    },
    recordStockMovement: (body: {
      variantId: string;
      delta: number;
      reason: string;
      refType?: string;
      refId?: string;
      note?: string;
    }) =>
      request<any>('/api/stock/movements', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createOrder: (body: any) =>
      request<any>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateOrderStatus: (id: string, status: string) =>
      request<any>(`/api/orders/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    listOrders: (params?: { status?: string; memberId?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.memberId) q.set('memberId', params.memberId);
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/orders?${q.toString()}`);
    },
    getOrder: (id: string) => request<any>(`/api/orders/${id}`),
  },

  bar: {
    getMenu: (params?: { category?: string; station?: string; active?: boolean }) => {
      const q = new URLSearchParams();
      if (params?.category) q.set('category', params.category);
      if (params?.station) q.set('station', params.station);
      if (params?.active !== undefined) q.set('active', String(params.active));
      return request<any[]>(`/api/admin/menu?${q.toString()}`);
    },
    getTables: () => request<any[]>('/api/admin/tables'),
    openTill: (body: { openingFloatPaise: number }) =>
      request<any>('/api/till/open', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    closeTill: (body: { tillSessionId: string; countedCashPaise: number }) =>
      request<any>('/api/till/close', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createTab: (body: { tableId?: string; memberId?: string; guestLabel?: string; tillSessionId?: string }) =>
      request<any>('/api/tabs', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getTab: (id: string) => request<any>(`/api/tabs/${id}`),
    addTabItem: (tabId: string, body: { menuItemId: string; qty?: number }) =>
      request<any>(`/api/tabs/${tabId}/items`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateTabItemStatus: (itemId: string, status: 'pending' | 'preparing' | 'ready' | 'served') =>
      request<any>(`/api/tab-items/${itemId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    voidTabItem: (itemId: string, voidReason: string) =>
      request<any>(`/api/tab-items/${itemId}/void`, {
        method: 'POST',
        body: JSON.stringify({ voidReason }),
      }),
    settleTab: (tabId: string, body: { payments: Array<{ method: string; amountPaise: number }> }) =>
      request<any>(`/api/tabs/${tabId}/settle`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getKds: (station: 'kitchen' | 'bar', history?: boolean) => {
      const q = new URLSearchParams({ station });
      if (history) q.set('history', 'true');
      return request<any[]>(`/api/kds?${q.toString()}`);
    },
    getZReport: (date: string) => {
      const q = new URLSearchParams({ date });
      return request<any>(`/api/reports/z?${q.toString()}`);
    },
  },

  crm: {
    listLeads: (params?: { stage?: string; assignedTo?: string; source?: string; limit?: number; cursor?: string }) => {
      const q = new URLSearchParams();
      if (params?.stage) q.set('stage', params.stage);
      if (params?.assignedTo) q.set('assignedTo', params.assignedTo);
      if (params?.source) q.set('source', params.source);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.cursor) q.set('cursor', params.cursor);
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/leads?${q.toString()}`);
    },
    getLead: (id: string) => request<any>(`/api/leads/${id}`),
    updateLead: (id: string, body: { stage?: string; assignedTo?: string | null; lostReason?: string | null; interest?: string }) =>
      request<any>(`/api/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    addNote: (id: string, body: string) =>
      request<any>(`/api/leads/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    addTask: (id: string, body: { title: string; dueOn: string; assignedTo?: string }) =>
      request<any>(`/api/leads/${id}/tasks`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateTask: (taskId: string, body: { done: boolean }) =>
      request<any>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    createQuote: (
      id: string,
      body: {
        lines: Array<{ description: string; qty: number; unitPricePaise: number }>;
        validUntil?: string;
      }
    ) =>
      request<any>(`/api/leads/${id}/quotes`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    sendQuote: (quoteId: string) =>
      request<{ success: boolean; quote: any; message?: string }>(`/api/quotes/${quoteId}/send`, {
        method: 'POST',
      }),
    convertLead: (
      id: string,
      body: {
        planCode: 'gold' | 'silver' | 'junior';
        dob?: string;
        photoUrl?: string;
        notes?: string;
      }
    ) =>
      request<{
        memberId: string;
        memberCode: string;
        membershipId: string;
        invoiceId: string;
      }>(`/api/leads/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  finance: {
    getSummary: (params: { from: string; to: string; group?: 'day' | 'week' | 'month' }) => {
      const q = new URLSearchParams({ from: params.from, to: params.to });
      if (params.group) q.set('group', params.group);
      return request<any>(`/api/finance/summary?${q.toString()}`);
    },
    getReceivables: () => request<any>('/api/finance/receivables'),
    getInvoices: (params?: { status?: string; memberId?: string; businessClientId?: string; limit?: number; cursor?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.memberId) q.set('memberId', params.memberId);
      if (params?.businessClientId) q.set('businessClientId', params.businessClientId);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.cursor) q.set('cursor', params.cursor);
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/invoices?${q.toString()}`);
    },
    getInvoice: (id: string) => request<any>(`/api/invoices/${id}`),
    createInvoice: (body: any) =>
      request<any>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getInvoicePdfHtml: (id: string) => request<string>(`/api/invoices/${id}/pdf`),
    getExpenses: (params?: { status?: string; category?: string; limit?: number; cursor?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.category) q.set('category', params.category);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.cursor) q.set('cursor', params.cursor);
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/expenses?${q.toString()}`);
    },
    createExpense: (body: {
      category: string;
      description: string;
      amountPaise: number;
      incurredOn: string;
      paid?: boolean;
      receiptUrl?: string;
    }) =>
      request<any>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    approveExpense: (id: string, approve: boolean, note?: string) =>
      request<any>(`/api/expenses/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approve, note }),
      }),
  },

  hr: {
    getEmployees: (params?: { active?: boolean; limit?: number; cursor?: string }) => {
      const q = new URLSearchParams();
      if (params?.active !== undefined) q.set('active', String(params.active));
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.cursor) q.set('cursor', params.cursor);
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/employees?${q.toString()}`);
    },
    createEmployee: (body: {
      name: string;
      phone: string;
      email: string;
      roleTitle: string;
      joinedOn: string;
      active?: boolean;
      userId?: string;
    }) =>
      request<any>('/api/employees', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getWorkShifts: (params?: { employeeId?: string; from?: string; to?: string; area?: string }) => {
      const q = new URLSearchParams();
      if (params?.employeeId) q.set('employeeId', params.employeeId);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      if (params?.area) q.set('area', params.area);
      return request<any[]>(`/api/work-shifts?${q.toString()}`);
    },
    getLeaveBalances: (employeeId?: string) => {
      const q = new URLSearchParams();
      if (employeeId) q.set('employeeId', employeeId);
      return request<any[]>(`/api/leave/balances?${q.toString()}`);
    },
    getLeaveRequests: (params?: { employeeId?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.employeeId) q.set('employeeId', params.employeeId);
      if (params?.status) q.set('status', params.status);
      return request<{ items: any[] }>(`/api/leave/requests?${q.toString()}`);
    },
    createLeaveRequest: (body: {
      employeeId: string;
      leaveTypeId: string;
      fromOn: string;
      toOn: string;
      days?: number;
      reason?: string;
    }) =>
      request<any>('/api/leave/requests', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    approveLeaveRequest: (id: string, note?: string) =>
      request<any>(`/api/leave/requests/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }),
    rejectLeaveRequest: (id: string, reason: string) =>
      request<any>(`/api/leave/requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    runPayroll: (month: string) =>
      request<any>('/api/payroll/run', {
        method: 'POST',
        body: JSON.stringify({ month }),
      }),
    getPayslips: (params?: { month?: string; employeeId?: string }) => {
      const q = new URLSearchParams();
      if (params?.month) q.set('month', params.month);
      if (params?.employeeId) q.set('employeeId', params.employeeId);
      return request<any[]>(`/api/payslips?${q.toString()}`);
    },
  },

  admin: {
    getSetting: (key: string) => request<{ key: string; value: any; description?: string }>(`/api/admin/settings/${key}`),
    updateSetting: (key: string, value: any, description?: string) =>
      request<{ key: string; value: any; description?: string }>(`/api/admin/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value, description }),
      }),
    getPriceRules: (params?: { appliesTo?: string; tier?: string; active?: boolean; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.appliesTo) q.set('appliesTo', params.appliesTo);
      if (params?.tier) q.set('tier', params.tier);
      if (params?.active !== undefined) q.set('active', String(params.active));
      if (params?.limit) q.set('limit', String(params.limit));
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/admin/price-rules?${q.toString()}`);
    },
    createPriceRule: (body: any) =>
      request<any>('/api/admin/price-rules', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updatePriceRule: (id: string, body: any) =>
      request<any>(`/api/admin/price-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deletePriceRule: (id: string) =>
      request<{ success: boolean }>(`/api/admin/price-rules/${id}`, {
        method: 'DELETE',
      }),
    getTaxRates: () => request<any[]>('/api/admin/tax-rates'),
    updateTaxRate: (id: string, body: { rateBps: number; description?: string }) =>
      request<any>(`/api/admin/tax-rates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    getRoles: () => request<any[]>('/api/admin/roles'),
    updateRolePermissions: (roleId: string, permissionIds: string[]) =>
      request<any>(`/api/admin/roles/${roleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds }),
      }),
    getAuditLogs: (params?: { limit?: number; resource?: string; actor?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.resource) q.set('resource', params.resource);
      if (params?.actor) q.set('actor', params.actor);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      return request<{ items: any[]; nextCursor?: string | null }>(`/api/admin/audit?${q.toString()}`);
    },
  },
};
