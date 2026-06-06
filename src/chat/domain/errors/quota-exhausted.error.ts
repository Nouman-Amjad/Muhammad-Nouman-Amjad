import { DomainError } from '../../../shared/domain/domain-error';
import { ErrorCode } from '../../../shared/errors/error-codes';

export class QuotaExhaustedError extends DomainError {
  readonly code = ErrorCode.QuotaExhausted;

  constructor(params: { userId: string; month: string }) {
    super('No free quota or active subscription bundle has remaining responses', {
      userId: params.userId,
      month: params.month,
    });
  }
}
