import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionBoundGuard } from '../../auth/guards/session-bound.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../shared/domain/role';

@Controller('metrics')
@UseGuards(JwtAuthGuard, SessionBoundGuard, RolesGuard)
@Roles(Role.Admin)
export class MetricsController {
  @Get()
  get(): Record<string, unknown> {
    const mem = process.memoryUsage();
    return {
      uptime: Math.floor(process.uptime()),
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
    };
  }
}
