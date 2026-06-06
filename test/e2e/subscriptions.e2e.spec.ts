import { randomUUID } from 'crypto';
import { AppFixture } from '../helpers/app-fixture';

const DB_PRESENT = !!process.env['DATABASE_URL'];

(DB_PRESENT ? describe : describe.skip)('Subscriptions endpoints (e2e)', () => {
  let fixture: AppFixture;

  beforeAll(async () => {
    fixture = new AppFixture();
    await fixture.init();
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function authedPost(userId: string, sid: string, path: string, body: unknown) {
    const token = await fixture.tokens.sign({ sub: userId, sid });
    return fixture
      .request()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'e2e-test')
      .set('Content-Type', 'application/json')
      .send(body);
  }

  async function authedDelete(userId: string, sid: string, path: string) {
    const token = await fixture.tokens.sign({ sub: userId, sid });
    return fixture
      .request()
      .delete(path)
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'e2e-test');
  }

  async function authedGet(userId: string, sid: string, path: string) {
    const token = await fixture.tokens.sign({ sub: userId, sid });
    return fixture
      .request()
      .get(path)
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'e2e-test');
  }

  describe('POST /subscriptions', () => {
    it('creates a Basic/Monthly subscription', async () => {
      const userId = randomUUID();
      const sid = randomUUID();

      const res = await authedPost(userId, sid, '/subscriptions', {
        tier: 'BASIC',
        billingCycle: 'MONTHLY',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        userId,
        tier: 'BASIC',
        billingCycle: 'MONTHLY',
        active: true,
        autoRenew: true,
      });
    });

    it('returns 400 for an invalid tier', async () => {
      const userId = randomUUID();
      const res = await authedPost(userId, randomUUID(), '/subscriptions', {
        tier: 'INVALID',
        billingCycle: 'MONTHLY',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /subscriptions', () => {
    it('returns the user's subscription list', async () => {
      const userId = randomUUID();
      const sid = randomUUID();

      await authedPost(userId, sid, '/subscriptions', {
        tier: 'PRO',
        billingCycle: 'YEARLY',
      });

      const res = await authedGet(userId, sid, '/subscriptions');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ items: expect.any(Array), total: expect.any(Number) });
      expect((res.body.items as unknown[]).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /subscriptions/:id', () => {
    it('cancels an active subscription', async () => {
      const userId = randomUUID();
      const sid = randomUUID();

      const create = await authedPost(userId, sid, '/subscriptions', {
        tier: 'BASIC',
        billingCycle: 'MONTHLY',
      });
      const bundleId = (create.body as { id: string }).id;

      const del = await authedDelete(userId, sid, `/subscriptions/${bundleId}`);
      expect(del.status).toBe(204);
    });

    it('returns 409 for a double-cancel', async () => {
      const userId = randomUUID();
      const sid = randomUUID();

      const create = await authedPost(userId, sid, '/subscriptions', {
        tier: 'BASIC',
        billingCycle: 'MONTHLY',
      });
      const bundleId = (create.body as { id: string }).id;

      await authedDelete(userId, sid, `/subscriptions/${bundleId}`);
      const second = await authedDelete(userId, sid, `/subscriptions/${bundleId}`);
      expect(second.status).toBe(409);
    });

    it('returns 403 when a user tries to cancel another user's subscription', async () => {
      const owner = randomUUID();
      const attacker = randomUUID();

      const create = await authedPost(owner, randomUUID(), '/subscriptions', {
        tier: 'BASIC',
        billingCycle: 'MONTHLY',
      });
      const bundleId = (create.body as { id: string }).id;

      const res = await authedDelete(attacker, randomUUID(), `/subscriptions/${bundleId}`);
      expect(res.status).toBe(403);
    });
  });
});
