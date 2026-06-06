import { type Principal, Role } from '../../../shared/domain/role';
import { ChatMessage, DeductionSource } from '../entities/chat-message';
import { TokenUsage } from '../value-objects/token-usage';
import { ChatAccessPolicy } from './chat-access.policy';

const owner: Principal = { userId: 'user-1', role: Role.User };
const stranger: Principal = { userId: 'user-2', role: Role.User };
const admin: Principal = { userId: 'admin-1', role: Role.Admin };

const message = ChatMessage.create({
  id: 'm1',
  userId: 'user-1',
  question: 'hi',
  answer: 'hello',
  tokenUsage: TokenUsage.of(1, 1),
  source: DeductionSource.Free,
});

describe('ChatAccessPolicy', () => {
  const policy = new ChatAccessPolicy();

  it('lets a user act on their own resources', () => {
    expect(policy.canSendAs(owner, 'user-1')).toBe(true);
    expect(policy.canReadMessage(owner, message)).toBe(true);
  });

  it('blocks a user from another user resources', () => {
    expect(policy.canSendAs(stranger, 'user-1')).toBe(false);
    expect(policy.canReadMessage(stranger, message)).toBe(false);
  });

  it('grants an admin system-wide access', () => {
    expect(policy.canSendAs(admin, 'user-1')).toBe(true);
    expect(policy.canReadMessage(admin, message)).toBe(true);
    expect(policy.canViewOwnUsage(admin, 'user-99')).toBe(true);
  });
});
