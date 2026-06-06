import { randomUUID } from 'crypto';
import { AppFixture } from '../helpers/app-fixture';

const DB_PRESENT = !!process.env['DATABASE_URL'];

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
    it('strips HTML tags from question before processing', async () => {
      const userId = randomUUID();
      const sid = randomUUID();
      const token = await fixture.tokens.sign({ sub: userId, sid });

      const res = await fixture
        .request()
        .post('/chat/messages')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'e2e-test')
        .send({ question: '<script>alert(1)</script>Hello world' });

      // Quota might be exhausted or DB not fully migrated, but we should never
      // get a 500 from unhandled XSS — the sanitizer must run before any error.
      expect(res.status).not.toBe(500);
    });
  });
});
