import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { CalculationService } from '../../common/services/calculation.service';

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, CalculationService],
  exports: [ContractsService],
})
export class ContractsModule {}
