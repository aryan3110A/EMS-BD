import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../src/common/constants/enums';

const prisma = new PrismaClient();

async function main() {
  console.log('=====================================================');
  console.log('   EMS — Reset & Prepare Clean Database for Client   ');
  console.log('=====================================================\n');

  // Step 1: Delete all transactional data (contracts, production, inventory, logs)
  console.log('Step 1: Clearing all contract, production, inventory, and audit data...');

  // Child and related tables first to respect FK constraints
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

  // Step 2: Clean up test offices, test salespersons, and test buyers
  console.log('Step 2: Cleaning test buyers, test salespersons, and test offices...');

  // Retain only official buyers
  const officialBuyerCodes = ['BIMA', 'ALBAHADLI', 'HECHAM', 'NORTHAM'];
  const deletedBuyers = await prisma.buyer.deleteMany({
    where: { code: { notIn: officialBuyerCodes } },
  });
  console.log(` - Removed ${deletedBuyers.count} temporary/test buyers; kept official buyers.`);

  // Retain only official salespersons (Jyoti & Brahma Sir)
  const officialSalesCodes = ['SP-JYOTI', 'SP-BRAHMA'];
  const deletedSales = await prisma.salesperson.deleteMany({
    where: { code: { notIn: officialSalesCodes } },
  });
  console.log(` - Removed ${deletedSales.count} temporary/test salespersons; kept official salespersons.`);

  // Retain only official offices (AMD, MUM, DEL)
  const officialOfficeCodes = ['AMD', 'MUM', 'DEL'];
  const deletedOffices = await prisma.office.deleteMany({
    where: { code: { notIn: officialOfficeCodes } },
  });
  console.log(` - Removed ${deletedOffices.count} temporary/test offices; kept official offices.`);

  // Step 3: Configure clean users
  console.log('\nStep 3: Setting up required client testing users...');

  // Find Ahmedabad office
  const ahmedabad = await prisma.office.findUnique({ where: { code: 'AMD' } });
  if (!ahmedabad) {
    throw new Error('Ahmedabad office not found');
  }

  // Common password hash for 'admin123'
  const passwordHash = await bcrypt.hash('admin123', 10);

  // List of required users:
  // - 1 System Admin
  // - 2 Sales Users (sales1@ems.com, sales2@ems.com, and sales@ems.com for backwards compatibility)
  // - 2 Production Users (production1@ems.com, production2@ems.com, and production@ems.com)
  // - 1 Super Sales User (supersales@ems.com)
  // - 1 Accounts Team (accounts@ems.com)
  // - 1 Inventory Team (inventory@ems.com)
  const nedraLoc = await prisma.inventoryLocation.findUnique({ where: { code: 'NEDRA' } });
  const bhramanwadaLoc = await prisma.inventoryLocation.findUnique({ where: { code: 'BHRAMANWADA' } });

  const desiredUsers = [
    {
      email: 'admin@ems.com',
      name: 'System Admin',
      role: UserRole.SUPER_ADMIN,
      officeId: null,
    },
    {
      email: 'sales@ems.com',
      name: 'Sales User 1',
      role: UserRole.CONTRACT_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'sales1@ems.com',
      name: 'Sales User 1 (Alt)',
      role: UserRole.CONTRACT_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'sales2@ems.com',
      name: 'Sales User 2',
      role: UserRole.CONTRACT_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'supersales@ems.com',
      name: 'Super Sales User',
      role: UserRole.SUPER_SALES,
      officeId: ahmedabad.id,
    },
    {
      email: 'production@ems.com',
      name: 'Production User 1',
      role: UserRole.PRODUCTION_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'production1@ems.com',
      name: 'Production User 1 (Alt)',
      role: UserRole.PRODUCTION_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'production2@ems.com',
      name: 'Production User 2',
      role: UserRole.PRODUCTION_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'nedra.prod@ems.com',
      name: 'Nedra Plant Operator',
      role: UserRole.PRODUCTION_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'bhramanwada.prod@ems.com',
      name: 'Bhramanwada Plant Operator',
      role: UserRole.PRODUCTION_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'accounts@ems.com',
      name: 'Accounts Team',
      role: UserRole.ACCOUNTS_TEAM,
      officeId: ahmedabad.id,
    },
    {
      email: 'inventory@ems.com',
      name: 'Inventory Team',
      role: UserRole.INVENTORY_TEAM,
      officeId: ahmedabad.id,
    },
  ];

  // Upsert all desired users
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

  // Remove any obsolete test users not in desired list
  const allowedEmails = desiredUsers.map((u) => u.email);
  const deletedOldUsers = await prisma.user.deleteMany({
    where: { email: { notIn: allowedEmails } },
  });
  console.log(` - Removed ${deletedOldUsers.count} unneeded old users.`);
  console.log(` - Configured ${desiredUsers.length} client testing accounts.`);

  // Step 4: Verification of remaining counts
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
    const res: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "${tbl}";`
    );
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
