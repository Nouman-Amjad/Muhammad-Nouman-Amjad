import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { AuthModule } from '../auth/auth.module';
import { DomainExceptionFilter } from './filters/domain-exception.filter';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';
import { PrismaHealthIndicator } from './controllers/health.controller';

@Module({
  imports: [TerminusModule, AuthModule],
  controllers: [HealthController, MetricsController],
  providers: [
    PrismaHealthIndicator,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
