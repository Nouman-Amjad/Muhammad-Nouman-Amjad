import type { Result } from '../../../shared/domain/result';
import { err, ok } from '../../../shared/domain/result';
import { DeductionSource } from '../entities/chat-message';
import type { FreeQuotaWindow } from '../entities/free-quota-window';
import { MonthKey } from '../value-objects/month-key';
import type { QuotaBundleSnapshot } from '../value-objects/quota-bundle-snapshot';
import { QuotaExhaustedError } from '../errors/quota-exhausted.error';

export interface QuotaState {
  readonly userId: string;
  readonly freeWindow: FreeQuotaWindow;
  readonly bundles: readonly QuotaBundleSnapshot[];
}

export type DeductionPlan =
  | {
      readonly source: typeof DeductionSource.Free;
      readonly month: MonthKey;
      readonly nextUsed: number;
    }
  | {
      readonly source: typeof DeductionSource.Bundle;
      readonly bundleId: string;
      readonly unlimited: boolean;
    };

/**
 * Pure resolver for "which quota source pays for this message". It performs no I/O and
 * mutates nothing; it inspects a snapshot of state and returns the intent to apply. The
 * infrastructure layer re-runs this against row-locked state inside a transaction so the
 * decision and the write stay atomic under concurrency.
 *
 * Order of preference:
 *   1. Free monthly allowance (auto-reset because the window is keyed by month).
 *   2. The active bundle with the greatest remaining quota; an unlimited (Enterprise)
 *      bundle ranks above any finite balance. Ties break toward the most recently activated.
 */
export class QuotaService {
  resolveDeduction(state: QuotaState, now: Date): Result<DeductionPlan, QuotaExhaustedError> {
    const currentMonth = MonthKey.current(now);

    if (state.freeWindow.hasRemainingIn(currentMonth)) {
      return ok({
        source: DeductionSource.Free,
        month: currentMonth,
        nextUsed: state.freeWindow.usedIn(currentMonth) + 1,
      });
    }

    const bundle = this.selectBundle(state.bundles);
    if (bundle === null) {
      return err(new QuotaExhaustedError({ userId: state.userId, month: currentMonth.toString() }));
    }

    return ok({
      source: DeductionSource.Bundle,
      bundleId: bundle.bundleId,
      unlimited: bundle.isUnlimited,
    });
  }

  private selectBundle(bundles: readonly QuotaBundleSnapshot[]): QuotaBundleSnapshot | null {
    let selected: QuotaBundleSnapshot | null = null;

    for (const candidate of bundles) {
      if (!candidate.isConsumable) {
        continue;
      }
      if (selected === null || this.outranks(candidate, selected)) {
        selected = candidate;
      }
    }

    return selected;
  }

  private outranks(candidate: QuotaBundleSnapshot, incumbent: QuotaBundleSnapshot): boolean {
    if (candidate.rankableRemaining !== incumbent.rankableRemaining) {
      return candidate.rankableRemaining > incumbent.rankableRemaining;
    }
    return candidate.activatedAt.getTime() > incumbent.activatedAt.getTime();
  }
}
