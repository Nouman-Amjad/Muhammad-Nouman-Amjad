import { randomUUID } from 'crypto';
import { AppFixture } from '../helpers/app-fixture';

const DB_PRESENT = !!process.env['DATABASE_URL'];

// Rate-limiting tests need their own app instance with a very low limit so the
// test doesn't have to fire 20+ real HTTP requests.
(DB_PRESENT ? describe : describe.skip)('Rate limiting (e2e)', () => {
  let fixture: AppFixture;

  beforeAll(async () => {
    // Override to 2 req/min so we can hit the ceiling cheaply
    process.env['RATE_LIMIT_CHAT_PER_MINUTE'] = '2';
    fixture = new AppFixture();
    await fixture.init();
  });

  afterAll(async () => {
    delete process.env['RATE_LIMIT_CHAT_PER_MINUTE'];
    await fixture.close();
  });

  it('returns 429 after exceeding the per-user chat rate limit', async () => {
    const userId = randomUUID();
    const sid = randomUUID();
    const token = await fixture.tokens.sign({ sub: userId, sid });

    const get = () =>
      fixture
        .request()
        .get('/chat/messages')
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', 'e2e-test');

    const r1 = await get();
    const r2 = await get();
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    // Third request must be throttled
    const r3 = await get();
    expect(r3.status).toBe(429);
  });

  it('applies separate per-user counters (different users are not affected by each other)', async () => {
    const makeRequest = async (userId: string) => {
      const token = await fixture.tokens.sign({ sub: userId, sid: randomUUID() });
      return fixture
        .request()
        .get('/chat/messages')
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', 'e2e-test');
    };

    // First user exhausts their 2-request limit
    const userA = randomUUID();
    await makeRequest(userA);
    await makeRequest(userA);
    const blocked = await makeRequest(userA);
    expect(blocked.status).toBe(429);

    // A different user should still be able to make requests
    const userB = randomUUID();
    const fresh = await makeRequest(userB);
    expect(fresh.status).toBe(200);
  });
});

(DB_PRESENT ? describe : describe.skip)('Security middleware (e2e)', () => {
  let fixture: AppFixture;

  beforeAll(async () => {
    fixture = new AppFixture();
    await fixture.init();
  });

  afterAll(async () => {
    await fixture.close();
  });

  describe('GET /health', () => {
    it('returns 200 without auth', async () => {
      const res = await fixture.request().get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok' });
    });
  });

  describe('Request-ID propagation', () => {
    it('echoes a client-supplied X-Request-ID', async () => {
      const id = randomUUID();
      const res = await fixture.request().get('/health').set('X-Request-ID', id);
      expect(res.headers['x-request-id']).toBe(id);
    });

    it('generates X-Request-ID when absent', async () => {
      const res = await fixture.request().get('/health');
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('Content-Type enforcement', () => {
    it('returns 415 for POST without application/json content-type', async () => {
      const userId = randomUUID();
      const token = await fixture.tokens.sign({ sub: userId, sid: randomUUID() });

      const res = await fixture
        .request()
        .post('/chat/messages')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/plain')
        .send('hello');

      expect(res.status).toBe(415);
    });
  });

  describe('JWT auth guard', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await fixture.request().get('/chat/messages');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed Bearer token', async () => {
      const res = await fixture
        .request()
        .get('/chat/messages')
        .set('Authorization', 'Bearer not.a.jwt');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a token signed by a different key', async () => {
      // Token signed by a second factory (different key) — should fail JWKS verification.
      const otherFactory = new AppFixture().tokens;
      await otherFactory.init();
      const token = await otherFactory.sign({ sub: randomUUID(), sid: randomUUID() });

      const res = await fixture
        .request()
        .get('/chat/messages')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for an expired token', async () => {
      const token = await fixture.tokens.sign({
        sub: randomUUID(),
        sid: randomUUID(),
        expiresIn: '-1s',
      });

      const res = await fixture
        .request()
        .get('/chat/messages')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });

  describe('XSS sanitization', () => {
    it('strips HTML tags before storing — raw XSS payload never reaches the database', async () => {
      const userId = randomUUID();
      const sid = randomUUID();
      const token = await fixture.tokens.sign({ sub: userId, sid });

      const postRes = await fixture
        .request()
        .post('/chat/messages')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'e2e-test')
        .send({ question: '<script>alert(1)</script>Hello world' });

      // The sanitizer strips the script tag but keeps the text node "Hello world",
      // so the question is non-empty and must not cause a validation error (400)
      // or an unhandled server error (500).
      expect(postRes.status).not.toBe(400);
      expect(postRes.status).not.toBe(500);

      if (postRes.status === 201) {
        // If the message was persisted, verify the stored question has the XSS stripped
        const listRes = await fixture
          .request()
          .get('/chat/messages?limit=5&offset=0')
          .set('Authorization', `Bearer ${token}`)
          .set('User-Agent', 'e2e-test');

        expect(listRes.status).toBe(200);
        const serialized = JSON.stringify(listRes.body);
        expect(serialized).not.toContain('<script>');
        expect(serialized).not.toContain('alert(1)');
      }
    });
  });
});
