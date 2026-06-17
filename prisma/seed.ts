import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  UserRole,
  EuClassification,
  Incoterm,
  PaymentType,
  ContractStatus,
} from '../src/common/constants/enums';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const ahmedabad = await prisma.office.upsert({
    where: { code: 'AMD' },
    update: { name: 'Contract Office' },
    create: {
      code: 'AMD',
      name: 'Contract Office',
      city: 'Ahmedabad',
    },
  });

  await prisma.office.upsert({
    where: { code: 'MUM' },
    update: {},
    create: { code: 'MUM', name: 'Mumbai Office', city: 'Mumbai', isActive: false },
  });

  await prisma.office.upsert({
    where: { code: 'DEL' },
    update: {},
    create: { code: 'DEL', name: 'Delhi Office', city: 'Delhi', isActive: false },
  });

  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@ems.com' },
    update: {},
    create: {
      email: 'admin@ems.com',
      passwordHash,
      name: 'System Admin',
      role: UserRole.SUPER_ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'sales@ems.com' },
    update: { email: 'sales@ems.com', name: 'Contract Sales Team' },
    create: {
      email: 'sales@ems.com',
      passwordHash,
      name: 'Contract Sales Team',
      role: UserRole.CONTRACT_TEAM,
      officeId: ahmedabad.id,
    },
  });

  const jyoti = await prisma.salesperson.upsert({
    where: { code: 'SP-JYOTI' },
    update: {},
    create: { code: 'SP-JYOTI', name: 'Jyoti' },
  });

  await prisma.salesperson.upsert({
    where: { code: 'SP-BRAHMA' },
    update: {},
    create: { code: 'SP-BRAHMA', name: 'Brahma Sir' },
  });

  const countries = [
    { name: 'Greece', code: 'GR', euClassification: EuClassification.EU },
    { name: 'Hungary', code: 'HU', euClassification: EuClassification.EU },
    { name: 'Australia', code: 'AU', euClassification: EuClassification.NON_EU },
    { name: 'Canada', code: 'CA', euClassification: EuClassification.NON_EU },
    { name: 'Egypt', code: 'EG', euClassification: EuClassification.NON_EU },
    { name: 'Russia', code: 'RU', euClassification: EuClassification.NON_EU },
    { name: 'India', code: 'IN', euClassification: EuClassification.NON_EU },
  ];

  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, region: c.name },
    });
  }

  const greece = await prisma.country.findUnique({ where: { code: 'GR' } });
  const hungary = await prisma.country.findUnique({ where: { code: 'HU' } });
  const australia = await prisma.country.findUnique({ where: { code: 'AU' } });
  const canada = await prisma.country.findUnique({ where: { code: 'CA' } });
  const egypt = await prisma.country.findUnique({ where: { code: 'EG' } });
  const india = await prisma.country.findUnique({ where: { code: 'IN' } });

  const ports = [
    { name: 'THESSALONIKI-GREECE', countryId: greece!.id },
    { name: 'PIRAEUS-GREECE', countryId: greece!.id },
    { name: 'BUDAPEST-HUNGARY', countryId: hungary!.id },
    { name: 'SYDNEY-AUSTRALIA', countryId: australia!.id },
    { name: 'TORONTO-CANADA', countryId: canada!.id },
    { name: 'ALEXANDRIA-EGYPT', countryId: egypt!.id },
    { name: 'MUNDRA-INDIA', countryId: india!.id, portType: 'LOADING' },
  ];

  for (const p of ports) {
    const existing = await prisma.port.findFirst({ where: { name: p.name } });
    if (!existing) await prisma.port.create({ data: p });
  }

  const products = [
    { code: 'HSS', name: 'Hulled Sesame Seeds', variants: [{ code: 'TOASTED', name: 'Toasted', processingType: 'Toasted' }] },
    { code: 'NSS', name: 'Natural Sesame Seeds', variants: [{ code: 'ROASTED', name: 'Roasted', processingType: 'Roasted' }] },
    { code: 'BSS', name: 'Black Sesame Seeds', variants: [{ code: 'ROASTED', name: 'Roasted', processingType: 'Roasted' }] },
    { code: 'THSS', name: 'Toasted Hulled Sesame Seeds', variants: [] },
    { code: 'TURMERIC-FINGER', name: 'Turmeric Finger', variants: [{ code: 'FINGER', name: 'Finger', processingType: 'Finger' }] },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, name: p.name, category: 'Seeds & Spices' },
    });
    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { productId_code: { productId: product.id, code: v.code } },
        update: {},
        create: { ...v, productId: product.id },
      });
    }
  }

  const paper = await prisma.packagingType.upsert({
    where: { code: 'PAPER' },
    update: {},
    create: { code: 'PAPER', name: 'Paper Bags', material: 'Paper' },
  });

  await prisma.packagingSize.upsert({
    where: { id: 'seed-paper-25' },
    update: {},
    create: {
      id: 'seed-paper-25',
      packagingTypeId: paper.id,
      label: 'PAPER BAGS OF 25 KGS NET',
      weightKg: 25,
    },
  });

  const buyers = [
    { code: 'BIMA', name: 'BIMA NUTS DOO', countryId: hungary!.id },
    { code: 'ALBAHADLI', name: 'AL BAHADLI', countryId: greece!.id },
    { code: 'HECHAM', name: 'HECHAM GROUP', countryId: greece!.id },
    { code: 'NORTHAM', name: 'NORTH AMERICAN', countryId: canada!.id },
  ];

  for (const b of buyers) {
    await prisma.buyer.upsert({
      where: { code: b.code },
      update: {},
      create: { ...b, officeId: ahmedabad.id, euClassification: EuClassification.EU },
    });
  }

  const admin = await prisma.user.findUnique({ where: { email: 'admin@ems.com' } });
  const hss = await prisma.product.findUnique({ where: { code: 'HSS' } });
  const bima = await prisma.buyer.findUnique({ where: { code: 'BIMA' } });
  const thess = await prisma.port.findFirst({ where: { name: 'THESSALONIKI-GREECE' } });
  const paper25 = await prisma.packagingSize.findUnique({ where: { id: 'seed-paper-25' } });

  if (admin && hss && bima && thess && !await prisma.contract.findUnique({ where: { contractNumber: '05601' } })) {
    await prisma.contract.create({
      data: {
        officeId: ahmedabad.id,
        contractNumber: '05601',
        receivedDate: new Date('2026-04-01'),
        contractDate: new Date('2026-04-01'),
        signedContractReceivedDate: new Date('2026-04-01'),
        salespersonId: jyoti.id,
        buyerId: bima.id,
        productId: hss.id,
        invoiceNumber: '031',
        totalMt: 18,
        numberOfContainers: 1,
        incoterm: Incoterm.FOB,
        fobPrice: 1590,
        freight: 4500,
        cifPrice: 1830,
        exchangeRate: 92.74,
        fobInrPerKg: 147.45,
        originalContractPrice: 1590,
        packagingTypeId: paper.id,
        packagingSizeId: paper25?.id,
        packingDescription: 'PAPER BAGS OF 25 KGS NET',
        paymentType: PaymentType.ADVANCE,
        advancePercentage: 10,
        balancePercentage: 90,
        balancePaymentStage: 'AGAINST COPY OF DOCUMENTS',
        destinationPortId: thess.id,
        euClassification: EuClassification.EU,
        expectedShipmentDate: new Date('2026-04-15'),
        shipmentMonth: 'Apr-26',
        shipmentYear: 2026,
        shipmentHalf: 'FIRST_HALF',
        orderMt: 18,
        status: ContractStatus.CONFIRMED_FOR_PRODUCTION,
        productionInformed: true,
        productionInformedDate: new Date('2026-04-02'),
        createdById: admin.id,
        lots: {
          create: [{
            lotNumber: 'LOT-01',
            quantityMt: 18,
            numberOfContainers: 1,
            expectedShipmentDate: new Date('2026-04-15'),
            shipmentMonth: 'Apr-26',
            shipmentYear: 2026,
            shipmentHalf: 'FIRST_HALF',
            destinationPortId: thess.id,
          }],
        },
        statusHistory: {
          create: {
            toStatus: ContractStatus.CONFIRMED_FOR_PRODUCTION,
            changedBy: 'Seed',
            remarks: 'Demo contract from register',
          },
        },
      },
    });
  }

  console.log('Seed completed. Login: sales@ems.com / admin123 or admin@ems.com / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
