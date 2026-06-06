import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as supertest from 'supertest';
import type { SuperTest, Test as STTest } from 'supertest';
import { AppModule } from '../../src/app.module';
import { JwtVerificationService } from '../../src/auth/services/jwt-verification.service';
import { MockJwtVerificationService } from './mock-jwt-verification.service';
import { TokenFactory } from './token-factory';

export class AppFixture {
  private app!: INestApplication;
  readonly tokens = new TokenFactory();

  async init(): Promise<void> {
    await this.tokens.init();

    const mockJwt = new MockJwtVerificationService(
      this.tokens.getJwks(),
      this.tokens.issuer,
      this.tokens.audience,
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerificationService)
      .useValue(mockJwt)
      .compile();

    this.app = moduleRef.createNestApplication();
    this.app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await this.app.init();
  }

  request(): SuperTest<STTest> {
    return supertest(this.app.getHttpServer()) as unknown as SuperTest<STTest>;
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}
