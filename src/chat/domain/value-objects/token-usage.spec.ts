import { InvalidTokenUsageError, TokenUsage } from './token-usage';

describe('TokenUsage', () => {
  it('sums prompt and completion tokens', () => {
    expect(TokenUsage.of(12, 30).totalTokens).toBe(42);
  });

  it('rejects negative or fractional counts', () => {
    expect(() => TokenUsage.of(-1, 0)).toThrow(InvalidTokenUsageError);
    expect(() => TokenUsage.of(1.5, 0)).toThrow(InvalidTokenUsageError);
  });
});
