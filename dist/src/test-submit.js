"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const contracts_service_1 = require("./modules/contracts/contracts.service");
const enums_1 = require("./common/constants/enums");
async function test() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const contractsService = app.get(contracts_service_1.ContractsService);
    const payload = {
        contract: {
            officeId: "cmqjs7zho0001vjponh6zwnrh",
            contractDate: "2026-06-25",
            buyerId: "cmqsd6p4x0001103caohn8um9",
            productId: "cmqjqscuz00142ohg43734cse",
            totalMt: 52,
            numberOfContainers: 2,
            quantityUnit: "MT",
            fobCurrency: "USD",
            fobPriceUnit: "PER_MT",
            incoterm: "FOB",
            paymentType: "ADVANCE",
            advancePercentage: 10,
            status: "DRAFT",
            cifManualOverride: false,
            packingSizeUnit: "KG",
            destinationPortId: "",
            containerProducts: [
                {
                    containerIndex: 1,
                    productId: "cmqjqscuz00142ohg43734cse",
                    quantityMt: 26,
                    destinationPortId: "",
                    expectedShipmentDate: "",
                    shipmentMonthYear: "",
                    shipmentHalf: undefined,
                    incoterm: "FOB",
                    fobPrice: undefined,
                    exchangeRate: undefined
                },
                {
                    containerIndex: 2,
                    productId: "cmqjqscuz00142ohg43734cse",
                    quantityMt: 26,
                    destinationPortId: "",
                    expectedShipmentDate: "",
                    shipmentMonthYear: "",
                    shipmentHalf: undefined,
                    incoterm: "FOB",
                    fobPrice: undefined,
                    exchangeRate: undefined
                }
            ]
        },
        pendingMasters: {
            offices: [],
            salespersons: [],
            countries: [],
            buyers: [],
            products: [],
            productVariants: []
        }
    };
    const dbUsers = await contractsService.prisma.user.findMany();
    const user = {
        sub: dbUsers[0]?.id || "admin-id",
        email: "test@example.com",
        role: enums_1.UserRole.SUPER_ADMIN,
        name: "Admin"
    };
    try {
        console.log("Submitting draft contract...");
        const result = await contractsService.submit(payload, user);
        console.log("Success:", result);
    }
    catch (error) {
        console.error("Error occurred:", error);
    }
    finally {
        await app.close();
    }
}
test();
//# sourceMappingURL=test-submit.js.map