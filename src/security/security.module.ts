import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ContentTypeMiddleware } from './middleware/content-type.middleware';
import { RequestTimeoutMiddleware } from './middleware/request-timeout.middleware';
import { ThrottleByUserGuard } from './guards/throttle-by-user.guard';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.get<number>('RATE_LIMIT_AUTH_PER_MINUTE', 10),
          },
          {
            name: 'chat',
            ttl: 60_000,
            limit: config.get<number>('RATE_LIMIT_CHAT_PER_MINUTE', 20),
          },
          {
            name: 'subscription',
            ttl: 60_000,
            limit: config.get<number>('RATE_LIMIT_SUBSCRIPTION_PER_MINUTE', 30),
          },
        ],
      }),
    }),
  ],
  providers: [
    ContentTypeMiddleware,
    RequestTimeoutMiddleware,
    { provide: APP_GUARD, useClass: ThrottleByUserGuard },
  ],
  exports: [ThrottleByUserGuard],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestTimeoutMiddleware, ContentTypeMiddleware).forRoutes('*');
  }
}
