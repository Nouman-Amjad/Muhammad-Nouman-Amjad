export interface PaymentOutcome {
  readonly succeeded: boolean;
  readonly failureReason: string | null;
}

/**
 * Simulates an external payment processor. A configurable failure rate (default 20%)
 * produces random failures so the auto-renewal flow can exercise the deactivation path.
 * The randomness source is injectable so tests can supply a deterministic value.
 */
export class BillingSimulationService {
  constructor(private readonly failureRate: number = 0.2) {
    if (failureRate < 0 || failureRate > 1) {
      throw new RangeError('failureRate must be between 0 and 1');
    }
  }

  processPayment(randomValue: number = Math.random()): PaymentOutcome {
    if (randomValue < this.failureRate) {
      return { succeeded: false, failureReason: 'Payment declined by issuer' };
    }
    return { succeeded: true, failureReason: null };
  }
}
