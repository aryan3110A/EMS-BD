"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const contracts_service_1 = require("./modules/contracts/contracts.service");
async function test() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const contractsService = app.get(contracts_service_1.ContractsService);
    const prisma = contractsService.prisma;
    const buyerId = "cmqsdjsdo0003103c7rvwxzw9";
    const buyer = await prisma.buyer.findUnique({
        where: { id: buyerId }
    });
    console.log("Buyer check:", buyer);
    await app.close();
}
test();
//# sourceMappingURL=check-buyer.js.map