import type { TokenUsage } from '../../domain/value-objects/token-usage';

export interface AiChatResponse {
  readonly answer: string;
  readonly tokenUsage: TokenUsage;
}

export interface AiChatClientPort {
  chat(question: string): Promise<AiChatResponse>;
}

export const AI_CHAT_CLIENT = Symbol('AiChatClientPort');
