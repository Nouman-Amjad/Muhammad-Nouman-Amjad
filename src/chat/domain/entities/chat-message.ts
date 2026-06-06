import type { TokenUsage } from '../value-objects/token-usage';

export const DeductionSource = {
  Free: 'FREE',
  Bundle: 'BUNDLE',
} as const;

export type DeductionSource = (typeof DeductionSource)[keyof typeof DeductionSource];

export interface ChatMessageProps {
  readonly id: string;
  readonly userId: string;
  readonly question: string;
  readonly answer: string;
  readonly tokenUsage: TokenUsage;
  readonly source: DeductionSource;
  readonly bundleId: string | null;
  readonly createdAt: Date;
}

/**
 * A persisted question/answer exchange together with the usage that produced it. Acts as the
 * audit record the spec requires (question, answer, token usage, timestamp, user reference)
 * and remembers which quota source paid for it.
 */
export class ChatMessage {
  private constructor(private readonly props: ChatMessageProps) {}

  static create(params: {
    id: string;
    userId: string;
    question: string;
    answer: string;
    tokenUsage: TokenUsage;
    source: DeductionSource;
    bundleId?: string;
    createdAt?: Date;
  }): ChatMessage {
    const question = params.question.trim();
    if (question.length === 0) {
      throw new RangeError('question must not be empty');
    }
    if (params.source === DeductionSource.Bundle && !params.bundleId) {
      throw new RangeError('bundleId is required when source is BUNDLE');
    }
    return new ChatMessage({
      id: params.id,
      userId: params.userId,
      question,
      answer: params.answer,
      tokenUsage: params.tokenUsage,
      source: params.source,
      bundleId: params.bundleId ?? null,
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static restore(props: ChatMessageProps): ChatMessage {
    return new ChatMessage(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get question(): string {
    return this.props.question;
  }

  get answer(): string {
    return this.props.answer;
  }

  get tokenUsage(): TokenUsage {
    return this.props.tokenUsage;
  }

  get source(): DeductionSource {
    return this.props.source;
  }

  get bundleId(): string | null {
    return this.props.bundleId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isOwnedBy(userId: string): boolean {
    return this.props.userId === userId;
  }
}
