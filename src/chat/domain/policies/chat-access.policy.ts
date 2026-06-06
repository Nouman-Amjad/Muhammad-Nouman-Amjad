import { type Principal, Role } from '../../../shared/domain/role';
import type { ChatMessage } from '../entities/chat-message';

/**
 * Domain-level authorization for chat resources, enforced inside use-cases independently of
 * any controller guard. A user may only reach their own chats and quota; an admin has
 * system-wide read access.
 */
export class ChatAccessPolicy {
  canSendAs(principal: Principal, targetUserId: string): boolean {
    return principal.role === Role.Admin || principal.userId === targetUserId;
  }

  canViewOwnUsage(principal: Principal, targetUserId: string): boolean {
    return principal.role === Role.Admin || principal.userId === targetUserId;
  }

  canReadMessage(principal: Principal, message: ChatMessage): boolean {
    return principal.role === Role.Admin || message.isOwnedBy(principal.userId);
  }
}
