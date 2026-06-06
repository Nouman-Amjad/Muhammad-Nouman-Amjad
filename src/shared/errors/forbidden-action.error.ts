import { DomainError, type ErrorContext } from '../domain/domain-error';
import { ErrorCode } from './error-codes';

export class ForbiddenActionError extends DomainError {
  readonly code = ErrorCode.Forbidden;

  constructor(action: string, context: ErrorContext = {}) {
    super(`Action not permitted: ${action}`, context);
  }
}
