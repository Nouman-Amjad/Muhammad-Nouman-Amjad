# GGI Backend

Secure AI Chat and Subscription Bundles backend built to the GGI Backend Test Posture specification.

## Architecture

```
src/
├── chat/
│   ├── domain/          # Pure TypeScript — zero NestJS or Prisma imports
│   │   ├── entities/    # ChatMessage, FreeQuotaWindow
│   │   ├── value-objects/  # TokenUsage, MonthKey, QuotaBundleSnapshot
│   │   ├── services/    # QuotaService (pure, stateless resolver)
│   │   ├── policies/    # ChatAccessPolicy
│   │   └── repositories/   # Port interfaces (CHAT_MESSAGE_REPOSITORY, QUOTA_REPOSITORY)
│   ├── application/     # Use-cases (@Injectable, can import NestJS for DI)
│   ├── infrastructure/  # PrismaChatMessageRepository, PrismaQuotaRepository, MockOpenAiClient
│   └── controllers/     # ChatController + DTOs
├── subscriptions/       # Same layering as chat/
├── auth/                # Keycloak JWT verification + session-bound guard + RBAC guard
├── security/            # Helmet, CORS, rate limiting, content-type, request timeout
├── humanizer/           # Input sanitization (XSS/injection) + response metadata stripping
├── observability/       # DomainExceptionFilter, RequestIdMiddleware, /health, /metrics
└── shared/              # Result/Either monad, DomainError base, typed error catalog
humanizer/               # (runtime interceptors — same folder exposed as module)
prisma/                  # schema.prisma + migrations
test/                    # e2e tests + helpers
```

**Strict layering rule:** `domain/` has zero NestJS/Prisma imports. The application and infrastructure layers own all framework and I/O concerns. The domain is pure TypeScript and fully unit-testable without any mocking.

## Security model

| Layer | Mechanism |
|---|---|
| Transport | Helmet headers, restricted CORS, 16 KB body limit, 15 s request timeout |
| Content | `Content-Type: application/json` enforced on write methods (415 otherwise) |
| Authentication | Keycloak RS256 JWT validated against remote JWKS (issuer, audience, expiry) |
| Session binding | JWT's `sid` claim must map to an active server-side `Session` row with a matching HMAC-SHA256 device fingerprint. Token possession alone is insufficient. |
| Authorization | `RolesGuard` reads `realm_access.roles` from the verified payload. Admins can access any resource; users can only access their own. |
| Rate limiting | Three named throttler buckets (auth/chat/subscription) applied per user-ID when authenticated, per IP otherwise. |
| Input sanitization | `SanitizeInputInterceptor` strips HTML tags, event handler attributes, `javascript:` URIs, and null bytes before the business layer is reached. |
| Response hardening | `StripMetadataInterceptor` removes `stack`, `password`, `secret`, `token`, `authorization`, and any `_`-prefixed fields from serialized responses. |
| Quota atomicity | `SELECT … FOR UPDATE` pessimistic locking inside a Prisma interactive transaction. The pure `QuotaService.resolveDeduction()` is re-run against locked state so the decision and the write are atomic under concurrent requests. |

## Quota rules

- **Free tier:** 3 messages per calendar month per user. Resets automatically — the `FreeQuotaWindow` row is keyed on `(userId, monthKey)`, so a new month simply has no matching row.
- **Bundle tier:** Deducted after free allowance is exhausted. Among active bundles the one with the greatest remaining quota is chosen (unlimited Enterprise ranks highest; ties break toward most recently activated).
- **Enterprise:** Unlimited — the deduction step is skipped entirely.

## Setup

### Prerequisites

- Node.js ≥ 20
- Docker + Docker Compose

### Start infrastructure

```bash
docker compose up -d
```

Wait for the health checks to pass (postgres ~5 s, keycloak ~30 s).

### Configure environment

```bash
cp .env.example .env
# Edit .env — minimum required changes for local dev:
# DATABASE_URL is already set to match docker-compose defaults.
# Set SESSION_BINDING_SECRET to any ≥32-character random string.
```

### Install dependencies and migrate

```bash
npm install
npm run prisma:migrate    # applies migrations + generates Prisma client
```

### Run the server

```bash
npm run start:dev
```

The API is available at `http://localhost:3000`.

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | none | Liveness + database readiness |
| `GET /metrics` | admin | Process memory + uptime |
| `POST /chat/messages` | user/admin | Send a question, receive an AI answer |
| `GET /chat/messages` | user/admin | Paginated message history |
| `POST /subscriptions` | user/admin | Create a subscription bundle |
| `GET /subscriptions` | user/admin | List user's bundles |
| `DELETE /subscriptions/:id` | user/admin | Cancel a bundle |

## Testing

### Unit tests (no database)

```bash
npm test
```

Covers: quota resolution, monthly free reset, bundle ranking, subscription lifecycle, billing simulation, access policies. 53 tests.

### Integration tests (database required)

Tests `PrismaQuotaRepository` under real concurrency with `SELECT … FOR UPDATE`.

```bash
# Ensure docker-compose postgres is running and DATABASE_URL is set
npm run test:integration
```

Verifies:
- 6 concurrent free-quota requests → exactly 3 succeed
- 5 concurrent bundle requests → exactly 1 succeeds
- Enterprise never decrements

### E2e tests (database + full app)

```bash
npm install   # ensure supertest is installed
npm run test:e2e
```

Covers: JWT rejection (missing/malformed/expired/wrong-key), content-type enforcement, XSS sanitization, full chat flow including quota exhaustion, subscription CRUD, cross-user access denial.

All tests use a real RS256 keypair generated at test startup. No running Keycloak instance is required — the `JwtVerificationService` is overridden to use a local JWKS, testing the real `jose` verification path.

### Keycloak setup (production-like)

1. Create a realm named `ggi`.
2. Create a client `ggi-backend` (access type: bearer-only).
3. Add roles `user` and `admin` at the realm level.
4. Update `.env` with the actual `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URI`.
