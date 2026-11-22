import { Global, Module } from '@nestjs/common';
import { ContainerWorkflowService } from './container-workflow.service';
import { ContainerWorkflowController } from './container-workflow.controller';
import { InventoryLedgerService } from '../production/inventory-ledger.service';
import { NotificationService } from '../../common/services/notification.service';

/**
 * Global so every module shares ONE instance of each of these services.
 * (NotificationService holds the SSE event emitter: separate instances per module meant
 * live notifications raised by contracts/production never reached the SSE stream.)
 */
@Global()
@Module({
  controllers: [ContainerWorkflowController],
  providers: [ContainerWorkflowService, InventoryLedgerService, NotificationService],
  exports: [ContainerWorkflowService, InventoryLedgerService, NotificationService],
})
export class ContainerWorkflowModule {}
