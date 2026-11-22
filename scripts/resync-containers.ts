/**
 * Recalculate every container's operational stage with the ERP 22.11.26 workflow rules.
 * Safe to re-run (idempotent). Each change is written to container status history.
 *   container:  node dist/scripts/resync-containers.js
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ContainerWorkflowService } from '../src/modules/container-workflow/container-workflow.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const result = await app.get(ContainerWorkflowService).resyncAll(null);
    console.log(`Containers checked: ${result.containers}, stage changed: ${result.changed}`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
