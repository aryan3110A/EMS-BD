"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const enums_1 = require("../src/common/constants/enums");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('=====================================================');
    console.log('   EMS — Reset & Prepare Clean Database for Client   ');
    console.log('=====================================================\n');
    console.log('Step 1: Clearing all contract, production, inventory, and audit data...');
    console.log(' - Deleting notifications and audits...');
    await prisma.notification.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.contractAuditLog.deleteMany({});
    await prisma.productionAuditLog.deleteMany({});
    console.log(' - Deleting contract-related transactional tables...');
    await prisma.containerCommercialAmendment.deleteMany({});
    await prisma.containerStatusHistory.deleteMany({});
    await prisma.contractAmendment.deleteMany({});
    await prisma.contractDocument.deleteMany({});
    await prisma.contractStatusHistory.deleteMany({});
    await prisma.contractSalesAttribution.deleteMany({});
    await prisma.containerAllocation.deleteMany({});
    await prisma.contractContainerProduct.deleteMany({});
    await prisma.contractContainer.deleteMany({});
    await prisma.shipmentLot.deleteMany({});
    await prisma.contract.deleteMany({});
    console.log(' - Deleting quality control & sampling data...');
    await prisma.sampleRejectedLot.deleteMany({});
    await prisma.sampleRecord.deleteMany({});
    console.log(' - Deleting job work data...');
    await prisma.jobWorkWastageDisposition.deleteMany({});
    await prisma.jobWorkInwardLine.deleteMany({});
    await prisma.jobWorkInward.deleteMany({});
    await prisma.jobWorkOutward.deleteMany({});
    await prisma.jobWork.deleteMany({});
    console.log(' - Deleting production runs, wastage, and lot data...');
    await prisma.plantTransfer.deleteMany({});
    await prisma.productionWastageDisposition.deleteMany({});
    await prisma.cleaningWastageEntry.deleteMany({});
    await prisma.hullingWastageEntry.deleteMany({});
    await prisma.productionInput.deleteMany({});
    await prisma.wastageLot.deleteMany({});
    await prisma.processedOutputLot.deleteMany({});
    await prisma.productionRun.deleteMany({});
    console.log(' - Deleting inventory ledger, balances, and raw material inwards...');
    await prisma.inventoryLedgerEntry.deleteMany({});
    await prisma.inventoryBalance.deleteMany({});
    await prisma.rawMaterialInward.deleteMany({});
    console.log('✔ All transactional data cleared successfully.\n');
    console.log('Step 2: Cleaning test buyers, test salespersons, and test offices...');
    const officialBuyerCodes = ['BIMA', 'ALBAHADLI', 'HECHAM', 'NORTHAM'];
    const deletedBuyers = await prisma.buyer.deleteMany({
        where: { code: { notIn: officialBuyerCodes } },
    });
    console.log(` - Removed ${deletedBuyers.count} temporary/test buyers; kept official buyers.`);
    const officialSalesCodes = ['SP-JYOTI', 'SP-BRAHMA'];
    const deletedSales = await prisma.salesperson.deleteMany({
        where: { code: { notIn: officialSalesCodes } },
    });
    console.log(` - Removed ${deletedSales.count} temporary/test salespersons; kept official salespersons.`);
    const officialOfficeCodes = ['AMD', 'MUM', 'DEL'];
    const deletedOffices = await prisma.office.deleteMany({
        where: { code: { notIn: officialOfficeCodes } },
    });
    console.log(` - Removed ${deletedOffices.count} temporary/test offices; kept official offices.`);
    console.log('\nStep 3: Setting up required client testing users...');
    const ahmedabad = await prisma.office.findUnique({ where: { code: 'AMD' } });
    if (!ahmedabad) {
        throw new Error('Ahmedabad office not found');
    }
    const passwordHash = await bcrypt.hash('admin123', 10);
    const nedraLoc = await prisma.inventoryLocation.findUnique({ where: { code: 'NEDRA' } });
    const bhramanwadaLoc = await prisma.inventoryLocation.findUnique({ where: { code: 'BHRAMANWADA' } });
    const desiredUsers = [
        {
            email: 'admin@ems.com',
            name: 'System Admin',
            role: enums_1.UserRole.SUPER_ADMIN,
            officeId: null,
        },
        {
            email: 'sales@ems.com',
            name: 'Sales User 1',
            role: enums_1.UserRole.CONTRACT_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'sales1@ems.com',
            name: 'Sales User 1 (Alt)',
            role: enums_1.UserRole.CONTRACT_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'sales2@ems.com',
            name: 'Sales User 2',
            role: enums_1.UserRole.CONTRACT_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'supersales@ems.com',
            name: 'Super Sales User',
            role: enums_1.UserRole.SUPER_SALES,
            officeId: ahmedabad.id,
        },
        {
            email: 'production@ems.com',
            name: 'Production User 1',
            role: enums_1.UserRole.PRODUCTION_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'production1@ems.com',
            name: 'Production User 1 (Alt)',
            role: enums_1.UserRole.PRODUCTION_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'production2@ems.com',
            name: 'Production User 2',
            role: enums_1.UserRole.PRODUCTION_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'nedra.prod@ems.com',
            name: 'Nedra Plant Operator',
            role: enums_1.UserRole.PRODUCTION_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'bhramanwada.prod@ems.com',
            name: 'Bhramanwada Plant Operator',
            role: enums_1.UserRole.PRODUCTION_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'accounts@ems.com',
            name: 'Accounts Team',
            role: enums_1.UserRole.ACCOUNTS_TEAM,
            officeId: ahmedabad.id,
        },
        {
            email: 'inventory@ems.com',
            name: 'Inventory Team',
            role: enums_1.UserRole.INVENTORY_TEAM,
            officeId: ahmedabad.id,
        },
    ];
    for (const u of desiredUsers) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {
                name: u.name,
                role: u.role,
                officeId: u.officeId,
                passwordHash,
                isActive: true,
            },
            create: {
                email: u.email,
                name: u.name,
                role: u.role,
                officeId: u.officeId,
                passwordHash,
                isActive: true,
            },
        });
    }
    const allowedEmails = desiredUsers.map((u) => u.email);
    const deletedOldUsers = await prisma.user.deleteMany({
        where: { email: { notIn: allowedEmails } },
    });
    console.log(` - Removed ${deletedOldUsers.count} unneeded old users.`);
    console.log(` - Configured ${desiredUsers.length} client testing accounts.`);
    console.log('\nStep 4: Final verification of table row counts in Neon DB...');
    const tableCheck = [
        'User',
        'Office',
        'Salesperson',
        'Buyer',
        'Product',
        'Contract',
        'ContractContainer',
        'ProductionRun',
        'RawMaterialInward',
        'InventoryBalance',
        'InventoryLedgerEntry',
        'JobWork',
        'Notification',
        'AuditLog',
    ];
    for (const tbl of tableCheck) {
        const res = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tbl}";`);
        console.log(` - ${tbl.padEnd(25)} : ${Number(res[0]?.count ?? 0)} rows`);
    }
    console.log('\n=====================================================');
    console.log('   Database successfully prepared for client testing! ');
    console.log('=====================================================');
    await prisma.$disconnect();
}
main().catch(async (e) => {
    console.error('Error cleaning database:', e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=clean-db-for-testing.js.map