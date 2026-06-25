import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ContractsService } from './modules/contracts/contracts.service';
import { UserRole } from './common/constants/enums';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const contractsService = app.get(ContractsService);

  const dbUsers = await (contractsService as any).prisma.user.findMany();
  const user = {
    sub: dbUsers[0]?.id || "admin-id",
    email: "test@example.com",
    role: UserRole.SUPER_ADMIN,
    name: "Admin"
  };

  const createPayload = {
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

  try {
    console.log("1. Creating draft contract...");
    const draft = await contractsService.submit(createPayload as any, user);
    console.log("Draft created with ID:", draft.id);

    const updatePayload = {
      officeId: "cmqjs7zho0001vjponh6zwnrh",
      contractDate: "2026-06-25",
      contractSentDate: "2026-06-25",
      receivedDate: "2026-06-26",
      signedContractReceivedDate: "2026-06-27",
      buyerId: "cmqsd6p4x0001103caohn8um9",
      productId: "",
      salespersonId: "cmqjrt7ex0000vjpokbo8actg",
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
          fobPrice: 1000,
          fobCurrency: "USD",
          exchangeRate: 94.39,
          exchangeRateAt: "2026-06-25T17:00:10.000Z",
          exchangeRateSource: "LIVE"
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
          fobPrice: 1000,
          fobCurrency: "USD",
          exchangeRate: 94.39,
          exchangeRateAt: "2026-06-25T17:00:10.000Z",
          exchangeRateSource: "LIVE"
        }
      ]
    };

    console.log("2. Updating draft contract...");
    const result = await contractsService.update(draft.id, updatePayload as any, user);
    console.log("Update Success:", result);
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await app.close();
  }
}

test();
