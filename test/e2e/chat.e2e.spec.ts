import { randomUUID } from 'crypto';
import { AppFixture } from '../helpers/app-fixture';

const DB_PRESENT = !!process.env['DATABASE_URL'];

(DB_PRESENT ? describe : describe.skip)('Chat endpoints (e2e)', () => {
  let fixture: AppFixture;

  beforeAll(async () => {
    fixture = new AppFixture();
    await fixture.init();
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function authenticatedRequest(userId: string, sid: string) {
    const token = await fixture.tokens.sign({ sub: userId, sid });
    return {
      get: (path: string) =>
        fixture.request().get(path).set('Authorization', `Bearer ${token}`).set('User-Agent', 'e2e-test'),
      post: (path: string) =>
        fixture
          .request()
          .post(path)
          .set('Authorization', `Bearer ${token}`)
          .set('User-Agent', 'e2e-test')
          .set('Content-Type', 'application/json'),
    };
  }

  describe('POST /chat/messages', () => {
    it('sends a message and returns 201 with answer', async () => {
      const userId = randomUUID();
      const sid = randomUUID();
      const { post } = await authenticatedRequest(userId, sid);

      const res = await post('/chat/messages').send({ question: 'What is 2+2?' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        messageId: expect.any(String),
        answer: expect.any(String),
        promptTokens: expect.any(Number),
        completionTokens: expect.any(Number),
        source: 'FREE',
      });
    });

    it('exhausts the free quota after 3 messages', async () => {
      const userId = randomUUID();
      const sid = randomUUID();
      const { post } = await authenticatedRequest(userId, sid);

      for (let i = 0; i < 3; i++) {
        const r = await post('/chat/messages').send({ question: `Question ${i}` });
        expect(r.status).toBe(201);
      }

      const overflow = await post('/chat/messages').send({ question: 'One too many' });
      expect(overflow.status).toBe(429);
      expect(overflow.body.error).toBe('QUOTA_EXHAUSTED');
    });

    it('returns 400 for an empty question', async () => {
      const userId = randomUUID();
      const { post } = await authenticatedRequest(userId, randomUUID());

      const res = await post('/chat/messages').send({ question: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an unknown field (forbidNonWhitelisted)', async () => {
      const userId = randomUUID();
      const { post } = await authenticatedRequest(userId, randomUUID());

      const res = await post('/chat/messages').send({ question: 'Hi', injected: true });
      expect(res.status).toBe(400);
    });

    it('does not expose stack traces in error responses', async () => {
      const res = await fixture
        .request()
        .post('/chat/messages')
        .set('Content-Type', 'application/json')
        .send({ question: 'test' });

      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('stack');
    });
  });

  describe('GET /chat/messages', () => {
    it('returns the user's messages with pagination metadata', async () => {
      const userId = randomUUID();
      const sid = randomUUID();
      const { post, get } = await authenticatedRequest(userId, sid);

      await post('/chat/messages').send({ question: 'Hello!' });

      const res = await get('/chat/messages?limit=10&offset=0');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        items: expect.any(Array),
        total: expect.any(Number),
      });
    });
  });
});
