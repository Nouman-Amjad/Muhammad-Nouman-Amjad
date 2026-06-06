import { BillingSimulationService } from './billing-simulation.service';

describe('BillingSimulationService', () => {
  it('always succeeds when failureRate is 0', () => {
    const service = new BillingSimulationService(0);
    for (let i = 0; i < 20; i++) {
      expect(service.processPayment(Math.random()).succeeded).toBe(true);
    }
  });

  it('always fails when failureRate is 1', () => {
    const service = new BillingSimulationService(1);
    for (let i = 0; i < 20; i++) {
      expect(service.processPayment(Math.random()).succeeded).toBe(false);
    }
  });

  it('uses the injected random value to determine outcome deterministically', () => {
    const service = new BillingSimulationService(0.3);
    // randomValue < failureRate → failure
    expect(service.processPayment(0.1).succeeded).toBe(false);
    // randomValue >= failureRate → success
    expect(service.processPayment(0.5).succeeded).toBe(true);
  });

  it('populates failureReason only on failure', () => {
    const service = new BillingSimulationService(1);
    const { failureReason } = service.processPayment(0);
    expect(failureReason).not.toBeNull();
  });

  it('rejects an invalid failure rate', () => {
    expect(() => new BillingSimulationService(-0.1)).toThrow(RangeError);
    expect(() => new BillingSimulationService(1.1)).toThrow(RangeError);
  });
});
