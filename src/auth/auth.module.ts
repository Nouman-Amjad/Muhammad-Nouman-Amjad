import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SessionBoundGuard } from './guards/session-bound.guard';
import { JwtVerificationService } from './services/jwt-verification.service';
import { SessionService } from './services/session.service';

@Module({
  providers: [
    JwtVerificationService,
    SessionService,
    JwtAuthGuard,
    SessionBoundGuard,
    RolesGuard,
  ],
  exports: [
    JwtVerificationService,
    SessionService,
    JwtAuthGuard,
    SessionBoundGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
