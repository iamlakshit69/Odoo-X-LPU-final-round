import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErrorCode, errorCodeSchema } from '@club/contract';

export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLOT_TAKEN: 409,
  OUT_OF_STOCK: 409,
  INVALID_STATE: 409,
  DAILY_LIMIT: 422,
  MEMBERSHIP_INACTIVE: 422,
  OVERPAYMENT: 422,
};

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(
    public readonly code: ErrorCode,
    message: string,
    statusCode?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode ?? ERROR_STATUS_MAP[code] ?? 400;
  }
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  // 1. AppError
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  // 2. Zod validation error
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION',
        message: 'Validation failed',
        details: { issues: error.issues },
      },
    });
  }

  // 3. Fastify validation error (fastify-type-provider-zod or schema validation)
  const anyErr = error as any;
  if (anyErr.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION',
        message: error.message || 'Validation failed',
        details: { issues: anyErr.validation },
      },
    });
  }

  // 4. Postgres exclusion constraint violation (code 23P01) -> SLOT_TAKEN
  if (anyErr.code === '23P01') {
    return reply.status(409).send({
      error: {
        code: 'SLOT_TAKEN',
        message: 'The requested slot is already booked or overlaps with an existing booking.',
      },
    });
  }

  // 5. Default 500 error
  reply.log.error(error);
  return reply.status(500).send({
    error: {
      code: 'VALIDATION',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    },
  });
}
