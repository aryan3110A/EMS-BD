import { Module, Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/roles.decorator';

@Controller('offices')
export class OfficesController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  findAll() {
    return this.prisma.office.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}

@Module({
  controllers: [OfficesController],
})
export class OfficesModule {}
