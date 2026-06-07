import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Request } from 'express';
import type { Principal } from './shared/domain/role';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { HumanizerModule } from './humanizer/humanizer.module';
import { ObservabilityModule } from './observability/observability.module';
import { SecurityModule } from './security/security.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    LoggerModule.forRoot({
      pinoHttp: {
        // userId is injected by JwtAuthGuard before the response completes;
        // responseTime is logged automatically as a top-level field by pino-http
        customProps: (req) => {
          const r = req as unknown as Request & { user?: Principal };
          return {
            requestId: r.headers['x-request-id'],
            userId: r.user?.userId ?? null,
          };
        },
        ...(process.env['NODE_ENV'] !== 'production'
          ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
          : {}),
      },
    }),
    PrismaModule,
    AuthModule,
    SecurityModule,
    HumanizerModule,
    ObservabilityModule,
    ChatModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
