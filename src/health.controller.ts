import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/roles.decorator';
import { PrismaService } from './prisma/prisma.service';

/** Liveness + database readiness probe used by Docker health checks and uptime monitors. */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok', database: 'up', uptimeSeconds: Math.round(process.uptime()) };
  }
}
