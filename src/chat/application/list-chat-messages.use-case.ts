import { Inject, Injectable } from '@nestjs/common';
import { CHAT_MESSAGE_REPOSITORY } from '../domain/repositories/chat-message.repository';
import type {
  ChatMessagePage,
  ChatMessageRepository,
} from '../domain/repositories/chat-message.repository';

export interface ListChatMessagesQuery {
  readonly userId: string;
  readonly limit: number;
  readonly offset: number;
}

@Injectable()
export class ListChatMessagesUseCase {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messageRepo: ChatMessageRepository,
  ) {}

  async execute(query: ListChatMessagesQuery): Promise<ChatMessagePage> {
    return this.messageRepo.list(query);
  }
}
