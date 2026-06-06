import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Result } from '../../shared/domain/result';
import { ok } from '../../shared/domain/result';
import { ChatMessage, DeductionSource } from '../domain/entities/chat-message';
import { CHAT_MESSAGE_REPOSITORY } from '../domain/repositories/chat-message.repository';
import type { ChatMessageRepository } from '../domain/repositories/chat-message.repository';
import { QUOTA_REPOSITORY } from '../domain/repositories/quota.repository';
import type { QuotaRepository } from '../domain/repositories/quota.repository';
import type { QuotaExhaustedError } from '../domain/errors/quota-exhausted.error';
import { QuotaService } from '../domain/services/quota.service';
import { AI_CHAT_CLIENT } from './ports/ai-chat-client.port';
import type { AiChatClientPort } from './ports/ai-chat-client.port';

export interface SendChatMessageCommand {
  readonly userId: string;
  readonly question: string;
}

export interface SendChatMessageResult {
  readonly messageId: string;
  readonly answer: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly source: string;
}

@Injectable()
export class SendChatMessageUseCase {
  private readonly quotaService = new QuotaService();

  constructor(
    @Inject(QUOTA_REPOSITORY) private readonly quotaRepo: QuotaRepository,
    @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messageRepo: ChatMessageRepository,
    @Inject(AI_CHAT_CLIENT) private readonly aiClient: AiChatClientPort,
  ) {}

  async execute(
    cmd: SendChatMessageCommand,
  ): Promise<Result<SendChatMessageResult, QuotaExhaustedError>> {
    const now = new Date();

    const deductionResult = await this.quotaRepo.deductWithinTransaction(
      cmd.userId,
      now,
      (state, ts) => this.quotaService.resolveDeduction(state, ts),
    );

    if (deductionResult.isErr) {
      return deductionResult;
    }

    const plan = deductionResult.value;
    const { answer, tokenUsage } = await this.aiClient.chat(cmd.question);

    const message = ChatMessage.create({
      id: randomUUID(),
      userId: cmd.userId,
      question: cmd.question,
      answer,
      tokenUsage,
      source: plan.source,
      ...(plan.source === DeductionSource.Bundle ? { bundleId: plan.bundleId } : {}),
    });

    await this.messageRepo.save(message);

    return ok({
      messageId: message.id,
      answer: message.answer,
      promptTokens: tokenUsage.promptTokens,
      completionTokens: tokenUsage.completionTokens,
      source: message.source,
    });
  }
}
