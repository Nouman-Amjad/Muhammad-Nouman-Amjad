import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
