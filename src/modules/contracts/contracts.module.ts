import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { CalculationService } from '../../common/services/calculation.service';
import { ExchangeRateService } from '../../common/services/exchange-rate.service';
import { ContractAuditService } from '../../common/services/contract-audit.service';
import { NotificationService } from '../../common/services/notification.service';

@Module({
  controllers: [ContractsController],
  providers: [
    ContractsService,
    CalculationService,
    ExchangeRateService,
    ContractAuditService,
    NotificationService,
  ],
  exports: [ContractsService],
})
export class ContractsModule {}
