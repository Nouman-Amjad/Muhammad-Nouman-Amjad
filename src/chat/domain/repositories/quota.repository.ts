import type { Result } from '../../../shared/domain/result';
import type { QuotaExhaustedError } from '../errors/quota-exhausted.error';
import type { DeductionPlan, QuotaState } from '../services/quota.service';

export type QuotaResolver = (
  state: QuotaState,
  now: Date,
) => Result<DeductionPlan, QuotaExhaustedError>;

export interface QuotaRepository {
  /**
   * Loads the user's free window and active bundles, then runs `resolve` against that state
   * and applies the resulting plan — all inside a single serialized transaction with the
   * candidate rows locked. Implementations guarantee atomicity under concurrent requests.
   */
  deductWithinTransaction(
    userId: string,
    now: Date,
    resolve: QuotaResolver,
  ): Promise<Result<DeductionPlan, QuotaExhaustedError>>;

  getState(userId: string, now: Date): Promise<QuotaState>;
}

export const QUOTA_REPOSITORY = Symbol('QuotaRepository');
