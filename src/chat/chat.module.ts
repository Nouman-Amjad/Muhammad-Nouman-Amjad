import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HumanizerModule } from '../humanizer/humanizer.module';
import { PrismaChatMessageRepository } from './infrastructure/prisma-chat-message.repository';
import { PrismaQuotaRepository } from './infrastructure/prisma-quota.repository';
import { MockOpenAiClient } from './infrastructure/mock-openai.client';
import { SendChatMessageUseCase } from './application/send-chat-message.use-case';
import { ListChatMessagesUseCase } from './application/list-chat-messages.use-case';
import { ChatController } from './controllers/chat.controller';
import { CHAT_MESSAGE_REPOSITORY } from './domain/repositories/chat-message.repository';
import { QUOTA_REPOSITORY } from './domain/repositories/quota.repository';
import { AI_CHAT_CLIENT } from './application/ports/ai-chat-client.port';

@Module({
  imports: [AuthModule, HumanizerModule],
  controllers: [ChatController],
  providers: [
    { provide: CHAT_MESSAGE_REPOSITORY, useClass: PrismaChatMessageRepository },
    { provide: QUOTA_REPOSITORY, useClass: PrismaQuotaRepository },
    { provide: AI_CHAT_CLIENT, useClass: MockOpenAiClient },
    SendChatMessageUseCase,
    ListChatMessagesUseCase,
  ],
})
export class ChatModule {}
