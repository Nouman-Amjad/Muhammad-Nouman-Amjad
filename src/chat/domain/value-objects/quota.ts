import { DomainError } from '../../../shared/domain/domain-error';
import { ErrorCode } from '../../../shared/errors/error-codes';

export class InvalidQuotaError extends DomainError {
  readonly code = ErrorCode.InvalidQuota;

  constructor(reason: string) {
    super(`Invalid quota: ${reason}`);
  }
}

/** Immutable non-negative count of remaining responses. */
export class Quota {
  private constructor(readonly remaining: number) {}

  static of(remaining: number): Quota {
    if (!Number.isInteger(remaining) || remaining < 0) {
      throw new InvalidQuotaError('remaining must be a non-negative integer');
    }
    return new Quota(remaining);
  }

  static zero(): Quota {
    return new Quota(0);
  }

  get isExhausted(): boolean {
    return this.remaining === 0;
  }

  decrement(): Quota {
    if (this.isExhausted) {
      throw new InvalidQuotaError('cannot decrement an exhausted quota');
    }
    return new Quota(this.remaining - 1);
  }
}
