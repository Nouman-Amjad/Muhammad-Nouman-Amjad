import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionBoundGuard } from '../../auth/guards/session-bound.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../shared/domain/role';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Controller('metrics')
@UseGuards(JwtAuthGuard, SessionBoundGuard, RolesGuard)
@Roles(Role.Admin)
@SkipThrottle({ chat: true, subscription: true })
export class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(): Promise<Record<string, unknown>> {
    const [totalMessages, totalUsers, subscriptionsByTier, activeSubscriptions] =
      await Promise.all([
        this.prisma.chatMessage.count(),
        this.prisma.user.count(),
        this.prisma.subscriptionBundle.groupBy({
          by: ['tier'],
          where: { active: true },
          _count: { id: true },
        }),
        this.prisma.subscriptionBundle.count({ where: { active: true } }),
      ]);

    const mem = process.memoryUsage();

    return {
      uptime: Math.floor(process.uptime()),
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
      usage: {
        totalMessages,
        totalUsers,
        activeSubscriptions,
        subscriptionsByTier: Object.fromEntries(
          subscriptionsByTier.map((s) => [s.tier, s._count.id]),
        ),
      },
    };
  }
}
