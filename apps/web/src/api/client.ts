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
    getKds: (station: 'kitchen' | 'bar') => {
      const q = new URLSearchParams({ station });
      return request<any[]>(`/api/kds?${q.toString()}`);
    },
    getZReport: (date: string) => {
      const q = new URLSearchParams({ date });
      return request<any>(`/api/reports/z?${q.toString()}`);
    },
  },
};
