import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiChatClientPort, AiChatResponse } from '../application/ports/ai-chat-client.port';
import { TokenUsage } from '../domain/value-objects/token-usage';

@Injectable()
export class MockOpenAiClient implements AiChatClientPort {
  private readonly minLatencyMs: number;
  private readonly maxLatencyMs: number;

  constructor(config: ConfigService) {
    this.minLatencyMs = config.get<number>('OPENAI_MOCK_MIN_LATENCY_MS', 150);
    this.maxLatencyMs = config.get<number>('OPENAI_MOCK_MAX_LATENCY_MS', 600);
  }

  async chat(question: string): Promise<AiChatResponse> {
    await this.simulateLatency();

    const promptTokens = Math.max(1, Math.floor(question.length / 4));
    const completionTokens = Math.floor(Math.random() * 180 + 20);

    return {
      answer: `I'm a mocked AI assistant. You asked: "${question.slice(0, 120)}"`,
      tokenUsage: TokenUsage.of(promptTokens, completionTokens),
    };
  }

  private simulateLatency(): Promise<void> {
    const delay =
      Math.random() * (this.maxLatencyMs - this.minLatencyMs) + this.minLatencyMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
