export const ErrorCode = {
  Validation: 'VALIDATION_FAILED',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  QuotaExhausted: 'QUOTA_EXHAUSTED',
  InvalidTokenUsage: 'INVALID_TOKEN_USAGE',
  InvalidQuota: 'INVALID_QUOTA',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
