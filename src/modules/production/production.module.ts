import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { JobWorkService } from './job-work.service';
import { ProductionAuditService } from './production-audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductionController],
  providers: [
    ProductionService,
    JobWorkService,
    ProductionAuditService,
  ],
  exports: [ProductionService, JobWorkService],
})
export class ProductionModule {}
