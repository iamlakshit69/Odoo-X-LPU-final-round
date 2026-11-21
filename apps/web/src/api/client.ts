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
};
