import { DomainError } from '../../../shared/domain/domain-error';
import { ErrorCode } from '../../../shared/errors/error-codes';

export class InvalidTokenUsageError extends DomainError {
  readonly code = ErrorCode.InvalidTokenUsage;

  constructor(reason: string) {
    super(`Invalid token usage: ${reason}`);
  }
}

export class TokenUsage {
  private constructor(
    readonly promptTokens: number,
    readonly completionTokens: number,
  ) {}

  static of(promptTokens: number, completionTokens: number): TokenUsage {
    for (const [label, value] of [
      ['promptTokens', promptTokens],
      ['completionTokens', completionTokens],
    ] as const) {
      if (!Number.isInteger(value) || value < 0) {
        throw new InvalidTokenUsageError(`${label} must be a non-negative integer`);
      }
    }
    return new TokenUsage(promptTokens, completionTokens);
  }

  get totalTokens(): number {
    return this.promptTokens + this.completionTokens;
  }
}
