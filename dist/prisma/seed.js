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
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const enums_1 = require("../src/common/constants/enums");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    const ahmedabad = await prisma.office.upsert({
        where: { code: 'AMD' },
        update: {},
        create: {
            code: 'AMD',
            name: 'Ahmedabad Contract Office',
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
            role: enums_1.UserRole.SUPER_ADMIN,
        },
    });
    await prisma.user.upsert({
        where: { email: 'ahmedabad@ems.com' },
        update: {},
        create: {
            email: 'ahmedabad@ems.com',
            passwordHash,
            name: 'Ahmedabad Contract Team',
            role: enums_1.UserRole.CONTRACT_TEAM,
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
        { name: 'Greece', code: 'GR', euClassification: enums_1.EuClassification.EU },
        { name: 'Hungary', code: 'HU', euClassification: enums_1.EuClassification.EU },
        { name: 'Australia', code: 'AU', euClassification: enums_1.EuClassification.NON_EU },
        { name: 'Canada', code: 'CA', euClassification: enums_1.EuClassification.NON_EU },
        { name: 'Egypt', code: 'EG', euClassification: enums_1.EuClassification.NON_EU },
        { name: 'Russia', code: 'RU', euClassification: enums_1.EuClassification.NON_EU },
        { name: 'India', code: 'IN', euClassification: enums_1.EuClassification.NON_EU },
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
        { name: 'THESSALONIKI-GREECE', countryId: greece.id },
        { name: 'PIRAEUS-GREECE', countryId: greece.id },
        { name: 'BUDAPEST-HUNGARY', countryId: hungary.id },
        { name: 'SYDNEY-AUSTRALIA', countryId: australia.id },
        { name: 'TORONTO-CANADA', countryId: canada.id },
        { name: 'ALEXANDRIA-EGYPT', countryId: egypt.id },
        { name: 'MUNDRA-INDIA', countryId: india.id, portType: 'LOADING' },
    ];
    for (const p of ports) {
        const existing = await prisma.port.findFirst({ where: { name: p.name } });
        if (!existing)
            await prisma.port.create({ data: p });
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
        { code: 'BIMA', name: 'BIMA NUTS DOO', countryId: hungary.id },
        { code: 'ALBAHADLI', name: 'AL BAHADLI', countryId: greece.id },
        { code: 'HECHAM', name: 'HECHAM GROUP', countryId: greece.id },
        { code: 'NORTHAM', name: 'NORTH AMERICAN', countryId: canada.id },
    ];
    for (const b of buyers) {
        await prisma.buyer.upsert({
            where: { code: b.code },
            update: {},
            create: { ...b, officeId: ahmedabad.id, euClassification: enums_1.EuClassification.EU },
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
                incoterm: enums_1.Incoterm.FOB,
                fobPrice: 1590,
                freight: 4500,
                cifPrice: 1830,
                exchangeRate: 92.74,
                fobInrPerKg: 147.45,
                originalContractPrice: 1590,
                packagingTypeId: paper.id,
                packagingSizeId: paper25?.id,
                packingDescription: 'PAPER BAGS OF 25 KGS NET',
                paymentType: enums_1.PaymentType.ADVANCE,
                advancePercentage: 10,
                balancePercentage: 90,
                balancePaymentStage: 'AGAINST COPY OF DOCUMENTS',
                destinationPortId: thess.id,
                euClassification: enums_1.EuClassification.EU,
                expectedShipmentDate: new Date('2026-04-15'),
                shipmentMonth: 'Apr-26',
                shipmentYear: 2026,
                shipmentHalf: 'FIRST_HALF',
                orderMt: 18,
                status: enums_1.ContractStatus.CONFIRMED_FOR_PRODUCTION,
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
                        toStatus: enums_1.ContractStatus.CONFIRMED_FOR_PRODUCTION,
                        changedBy: 'Seed',
                        remarks: 'Demo contract from register',
                    },
                },
            },
        });
    }
    console.log('Seed completed. Login: admin@ems.com / admin123');
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map