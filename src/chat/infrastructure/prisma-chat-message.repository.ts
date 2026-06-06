import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ChatMessage } from '../domain/entities/chat-message';
import type { DeductionSource } from '../domain/entities/chat-message';
import type {
  ChatMessagePage,
  ChatMessageRepository,
  ListChatMessagesQuery,
} from '../domain/repositories/chat-message.repository';
import { TokenUsage } from '../domain/value-objects/token-usage';

@Injectable()
export class PrismaChatMessageRepository implements ChatMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(message: ChatMessage): Promise<void> {
    await this.prisma.chatMessage.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        userId: message.userId,
        question: message.question,
        answer: message.answer,
        promptTokens: message.tokenUsage.promptTokens,
        completionTokens: message.tokenUsage.completionTokens,
        source: message.source,
        bundleId: message.bundleId,
        createdAt: message.createdAt,
      },
      update: {},
    });
  }

  async findById(id: string): Promise<ChatMessage | null> {
    const row = await this.prisma.chatMessage.findUnique({ where: { id } });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(query: ListChatMessagesQuery): Promise<ChatMessagePage> {
    const [rows, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { userId: query.userId },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.chatMessage.count({ where: { userId: query.userId } }),
    ]);

    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(row: {
    id: string;
    userId: string;
    question: string;
    answer: string;
    promptTokens: number;
    completionTokens: number;
    source: DeductionSource;
    bundleId: string | null;
    createdAt: Date;
  }): ChatMessage {
    return ChatMessage.restore({
      id: row.id,
      userId: row.userId,
      question: row.question,
      answer: row.answer,
      tokenUsage: TokenUsage.of(row.promptTokens, row.completionTokens),
      source: row.source,
      bundleId: row.bundleId,
      createdAt: row.createdAt,
    });
  }
}
