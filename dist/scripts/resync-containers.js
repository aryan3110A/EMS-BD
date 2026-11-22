"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const container_workflow_service_1 = require("../src/modules/container-workflow/container-workflow.service");
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: ['error', 'warn'] });
    try {
        const result = await app.get(container_workflow_service_1.ContainerWorkflowService).resyncAll(null);
        console.log(`Containers checked: ${result.containers}, stage changed: ${result.changed}`);
    }
    finally {
        await app.close();
    }
}
main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});
//# sourceMappingURL=resync-containers.js.map