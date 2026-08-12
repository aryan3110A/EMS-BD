import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationService } from '../../common/services/notification.service';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { ProductionAuditService } from './production-audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductionController],
  providers: [ProductionService, InventoryLedgerService, ProductionAuditService, NotificationService],
  exports: [ProductionService, InventoryLedgerService],
})
export class ProductionModule {}
