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
    // EU
    { name: 'Austria', code: 'AT', euClassification: EuClassification.EU },
    { name: 'Belgium', code: 'BE', euClassification: EuClassification.EU },
    { name: 'Bulgaria', code: 'BG', euClassification: EuClassification.EU },
    { name: 'Croatia', code: 'HR', euClassification: EuClassification.EU },
    { name: 'Cyprus', code: 'CY', euClassification: EuClassification.EU },
    { name: 'Czech Republic', code: 'CZ', euClassification: EuClassification.EU },
    { name: 'Denmark', code: 'DK', euClassification: EuClassification.EU },
    { name: 'Estonia', code: 'EE', euClassification: EuClassification.EU },
    { name: 'Finland', code: 'FI', euClassification: EuClassification.EU },
    { name: 'France', code: 'FR', euClassification: EuClassification.EU },
    { name: 'Germany', code: 'DE', euClassification: EuClassification.EU },
    { name: 'Greece', code: 'GR', euClassification: EuClassification.EU },
    { name: 'Hungary', code: 'HU', euClassification: EuClassification.EU },
    { name: 'Ireland', code: 'IE', euClassification: EuClassification.EU },
    { name: 'Italy', code: 'IT', euClassification: EuClassification.EU },
    { name: 'Latvia', code: 'LV', euClassification: EuClassification.EU },
    { name: 'Lithuania', code: 'LT', euClassification: EuClassification.EU },
    { name: 'Luxembourg', code: 'LU', euClassification: EuClassification.EU },
    { name: 'Malta', code: 'MT', euClassification: EuClassification.EU },
    { name: 'Netherlands', code: 'NL', euClassification: EuClassification.EU },
    { name: 'Poland', code: 'PL', euClassification: EuClassification.EU },
    { name: 'Portugal', code: 'PT', euClassification: EuClassification.EU },
    { name: 'Romania', code: 'RO', euClassification: EuClassification.EU },
    { name: 'Slovakia', code: 'SK', euClassification: EuClassification.EU },
    { name: 'Slovenia', code: 'SI', euClassification: EuClassification.EU },
    { name: 'Spain', code: 'ES', euClassification: EuClassification.EU },
    { name: 'Sweden', code: 'SE', euClassification: EuClassification.EU },
    // Non-EU — Americas
    { name: 'United States', code: 'US', euClassification: EuClassification.NON_EU },
    { name: 'Canada', code: 'CA', euClassification: EuClassification.NON_EU },
    { name: 'Mexico', code: 'MX', euClassification: EuClassification.NON_EU },
    { name: 'Brazil', code: 'BR', euClassification: EuClassification.NON_EU },
    { name: 'Argentina', code: 'AR', euClassification: EuClassification.NON_EU },
    { name: 'Chile', code: 'CL', euClassification: EuClassification.NON_EU },
    { name: 'Colombia', code: 'CO', euClassification: EuClassification.NON_EU },
    { name: 'Peru', code: 'PE', euClassification: EuClassification.NON_EU },
    // Non-EU — Middle East
    { name: 'United Arab Emirates', code: 'AE', euClassification: EuClassification.NON_EU },
    { name: 'Saudi Arabia', code: 'SA', euClassification: EuClassification.NON_EU },
    { name: 'Qatar', code: 'QA', euClassification: EuClassification.NON_EU },
    { name: 'Kuwait', code: 'KW', euClassification: EuClassification.NON_EU },
    { name: 'Oman', code: 'OM', euClassification: EuClassification.NON_EU },
    { name: 'Bahrain', code: 'BH', euClassification: EuClassification.NON_EU },
    { name: 'Israel', code: 'IL', euClassification: EuClassification.NON_EU },
    { name: 'Turkey', code: 'TR', euClassification: EuClassification.NON_EU },
    { name: 'Egypt', code: 'EG', euClassification: EuClassification.NON_EU },
    { name: 'Jordan', code: 'JO', euClassification: EuClassification.NON_EU },
    { name: 'Lebanon', code: 'LB', euClassification: EuClassification.NON_EU },
    { name: 'Iraq', code: 'IQ', euClassification: EuClassification.NON_EU },
    { name: 'Iran', code: 'IR', euClassification: EuClassification.NON_EU },
    // Non-EU — Asia Pacific
    { name: 'India', code: 'IN', euClassification: EuClassification.NON_EU },
    { name: 'China', code: 'CN', euClassification: EuClassification.NON_EU },
    { name: 'Japan', code: 'JP', euClassification: EuClassification.NON_EU },
    { name: 'South Korea', code: 'KR', euClassification: EuClassification.NON_EU },
    { name: 'Singapore', code: 'SG', euClassification: EuClassification.NON_EU },
    { name: 'Malaysia', code: 'MY', euClassification: EuClassification.NON_EU },
    { name: 'Indonesia', code: 'ID', euClassification: EuClassification.NON_EU },
    { name: 'Thailand', code: 'TH', euClassification: EuClassification.NON_EU },
    { name: 'Vietnam', code: 'VN', euClassification: EuClassification.NON_EU },
    { name: 'Philippines', code: 'PH', euClassification: EuClassification.NON_EU },
    { name: 'Pakistan', code: 'PK', euClassification: EuClassification.NON_EU },
    { name: 'Bangladesh', code: 'BD', euClassification: EuClassification.NON_EU },
    { name: 'Sri Lanka', code: 'LK', euClassification: EuClassification.NON_EU },
    { name: 'Nepal', code: 'NP', euClassification: EuClassification.NON_EU },
    { name: 'Australia', code: 'AU', euClassification: EuClassification.NON_EU },
    { name: 'New Zealand', code: 'NZ', euClassification: EuClassification.NON_EU },
    // Non-EU — Africa
    { name: 'South Africa', code: 'ZA', euClassification: EuClassification.NON_EU },
    { name: 'Kenya', code: 'KE', euClassification: EuClassification.NON_EU },
    { name: 'Nigeria', code: 'NG', euClassification: EuClassification.NON_EU },
    { name: 'Ghana', code: 'GH', euClassification: EuClassification.NON_EU },
    { name: 'Morocco', code: 'MA', euClassification: EuClassification.NON_EU },
    { name: 'Tunisia', code: 'TN', euClassification: EuClassification.NON_EU },
    { name: 'Algeria', code: 'DZ', euClassification: EuClassification.NON_EU },
    { name: 'Ethiopia', code: 'ET', euClassification: EuClassification.NON_EU },
    // Non-EU — Europe (non-EU)
    { name: 'United Kingdom', code: 'GB', euClassification: EuClassification.NON_EU },
    { name: 'Switzerland', code: 'CH', euClassification: EuClassification.NON_EU },
    { name: 'Norway', code: 'NO', euClassification: EuClassification.NON_EU },
    { name: 'Russia', code: 'RU', euClassification: EuClassification.NON_EU },
    { name: 'Ukraine', code: 'UA', euClassification: EuClassification.NON_EU },
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

  async function upsertProductWithVariants(
    code: string,
    name: string,
    extraVariants: { code: string; name: string; processingType?: string }[] = [],
  ) {
    const product = await prisma.product.upsert({
      where: { code },
      update: { name, isActive: true },
      create: { code, name, category: 'Seeds & Spices' },
    });
    const variants = [
      { code: 'NORMAL', name: 'Normal', processingType: 'Normal' },
      ...extraVariants,
    ];
    for (const v of variants) {
      await prisma.productVariant.upsert({
        where: { productId_code: { productId: product.id, code: v.code } },
        update: { name: v.name, processingType: v.processingType ?? v.name, isActive: true },
        create: {
          productId: product.id,
          code: v.code,
          name: v.name,
          processingType: v.processingType ?? v.name,
        },
      });
    }
  }

  await upsertProductWithVariants('HSS', 'Hulled Sesame Seeds', [
    { code: 'TOASTED', name: 'Toasted', processingType: 'Toasted' },
  ]);
  await upsertProductWithVariants('NSS', 'Natural Sesame Seeds', [
    { code: 'ROASTED', name: 'Roasted', processingType: 'Roasted' },
    { code: 'TOASTED', name: 'Toasted', processingType: 'Toasted' },
  ]);
  await upsertProductWithVariants('BSS', 'Black Sesame Seeds', [
    { code: 'ROASTED', name: 'Roasted', processingType: 'Roasted' },
    { code: 'TOASTED', name: 'Toasted', processingType: 'Toasted' },
  ]);
  await upsertProductWithVariants('CUMIN', 'Cumin Seeds');
  await upsertProductWithVariants('FLAX', 'Flax Seeds');
  await upsertProductWithVariants('AMARANTH', 'Amaranth Seeds');
  await upsertProductWithVariants('TURMERIC', 'Turmeric', [
    { code: 'FINGER', name: 'Finger', processingType: 'Finger' },
    { code: 'POWDER', name: 'Powder', processingType: 'Powder' },
  ]);
  await upsertProductWithVariants('CHIA', 'Chia Seeds');
  await upsertProductWithVariants('QUINOA', 'Quinoa Seeds');
  await upsertProductWithVariants('PSYLLIUM', 'Psyllium Husk');
  await upsertProductWithVariants('NIGELLA', 'Nigella Seeds');
  await upsertProductWithVariants('FENNEL', 'Fennel Seeds');
  await upsertProductWithVariants('FENUGREEK', 'Fenugreek');

  await prisma.product.updateMany({
    where: { code: { in: ['THSS', 'TURMERIC-FINGER'] } },
    data: { isActive: false },
  });

  const paper = await prisma.packagingType.upsert({
    where: { code: 'PAPER' },
    update: {},
    create: { code: 'PAPER', name: 'Paper Bags', material: 'Paper' },
  });

  await prisma.packagingType.upsert({
    where: { code: 'PP' },
    update: {},
    create: { code: 'PP', name: 'PP', material: 'PP' },
  });

  await prisma.packagingType.upsert({
    where: { code: 'JUMBO' },
    update: {},
    create: { code: 'JUMBO', name: 'Jumbo', material: 'Jumbo' },
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
