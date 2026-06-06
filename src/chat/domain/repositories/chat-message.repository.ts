import type { ChatMessage } from '../entities/chat-message';

export interface ChatMessagePage {
  readonly items: readonly ChatMessage[];
  readonly total: number;
}

export interface ListChatMessagesQuery {
  readonly userId: string;
  readonly limit: number;
  readonly offset: number;
}

export interface ChatMessageRepository {
  save(message: ChatMessage): Promise<void>;
  findById(id: string): Promise<ChatMessage | null>;
  list(query: ListChatMessagesQuery): Promise<ChatMessagePage>;
}

export const CHAT_MESSAGE_REPOSITORY = Symbol('ChatMessageRepository');
