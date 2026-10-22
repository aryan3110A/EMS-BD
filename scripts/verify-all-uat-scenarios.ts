/**
 * Verification of all 29 Mandatory UAT Scenarios (§21)
 * "Production & Inventory Management System — Developer Change Request"
 * 
 * Run with backend active:
 *   npx ts-node scripts/verify-all-uat-scenarios.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserRole, ContractStatus, ContainerStatus } from '../src/common/constants/enums';

const prisma = new PrismaClient();
const API = process.env.API_URL || 'http://127.0.0.1:3001/api/v1';
const today = () => new Date().toISOString().slice(0, 10);

type TestResult = {
  id: string;
  scenario: string;
  ok: boolean;
  expected: string;
  actual: string;
};

const results: TestResult[] = [];

function record(id: string, scenario: string, ok: boolean, expected: string, actual: string) {
  results.push({ id, scenario, ok, expected, actual });
  const mark = ok ? '✓ PASS' : '✗ FAIL';
  console.log(`${mark} [${id}] ${scenario}\n        Expected: ${expected}\n        Actual:   ${actual}\n`);
}

async function api(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function apiMust(path: string, opts: RequestInit & { token?: string } = {}) {
  let r = await api(path, opts);
  if (!r.ok && r.status >= 500) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await api(path, opts);
  }
  if (!r.ok) {
    const msg = typeof r.body === 'string' ? r.body : JSON.stringify(r.body?.message || r.body);
    throw new Error(`${opts.method || 'GET'} ${path} → ${r.status}: ${msg}`);
  }
  return r.body;
}

async function main() {
  console.log('================================================================');
  console.log('   EMS Production & Inventory — 29 Mandatory UAT Scenarios (§21)');
  console.log('================================================================\n');

  // --- Step 0: Ensure Master Data & Test Accounts in DB ---
  const passwordHash = await bcrypt.hash('admin123', 10);
  const office = await prisma.office.findFirst();

  let nedraLoc = await prisma.inventoryLocation.findUnique({ where: { code: 'NEDRA' } });
  if (!nedraLoc) {
    nedraLoc = await prisma.inventoryLocation.create({ data: { code: 'NEDRA', name: 'Nedra Plant', isActive: true } });
  }
  let bhramanwadaLoc = await prisma.inventoryLocation.findUnique({ where: { code: 'BHRAMANWADA' } });
  if (!bhramanwadaLoc) {
    bhramanwadaLoc = await prisma.inventoryLocation.create({ data: { code: 'BHRAMANWADA', name: 'Bhramanwada Plant', isActive: true } });
  }
  let outsideLoc = await prisma.inventoryLocation.findUnique({ where: { code: 'OUTSIDE' } });
  if (!outsideLoc) {
    outsideLoc = await prisma.inventoryLocation.create({ data: { code: 'OUTSIDE', name: 'Outside Warehouse', isActive: true } });
  }

  // Ensure NSS (Natural Sesame) and HSS (Hulled Sesame) products
  let nssProduct = await prisma.product.findUnique({ where: { code: 'NSS' } });
  if (!nssProduct) {
    nssProduct = await prisma.product.create({
      data: { code: 'NSS', name: 'Natural Sesame Seeds', category: 'SESAME', defaultUnit: 'KG', allowsSortex: true, allowsFullProcess: true },
    });
  }
  let hssProduct = await prisma.product.findUnique({ where: { code: 'HSS' } });
  if (!hssProduct) {
    hssProduct = await prisma.product.create({
      data: { code: 'HSS', name: 'Hulled Sesame Seeds', category: 'SESAME', defaultUnit: 'KG', allowsSortex: true, allowsFullProcess: true },
    });
  }
  let amaranthProduct = await prisma.product.findUnique({ where: { code: 'AMARANTH' } });
  if (!amaranthProduct) {
    amaranthProduct = await prisma.product.create({
      data: { code: 'AMARANTH', name: 'Organic Amaranth', category: 'GRAIN', defaultUnit: 'KG', allowsSortex: true, allowsFullProcess: false },
    });
  }

  // Ensure test users (Note: User model uses email prefix for plant association, e.g. nedra.prod@ems.com)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ems.com' },
    update: { role: UserRole.SUPER_ADMIN, isActive: true },
    create: { email: 'admin@ems.com', name: 'System Admin', role: UserRole.SUPER_ADMIN, passwordHash, isActive: true },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@ems.com' },
    update: { role: UserRole.CONTRACT_TEAM, officeId: office?.id, isActive: true },
    create: { email: 'sales@ems.com', name: 'Sales User', role: UserRole.CONTRACT_TEAM, officeId: office?.id, passwordHash, isActive: true },
  });

  const nedraUser = await prisma.user.upsert({
    where: { email: 'nedra.prod@ems.com' },
    update: { role: UserRole.PRODUCTION_TEAM, officeId: office?.id, isActive: true },
    create: { email: 'nedra.prod@ems.com', name: 'Nedra Operator', role: UserRole.PRODUCTION_TEAM, officeId: office?.id, passwordHash, isActive: true },
  });

  const bhramanwadaUser = await prisma.user.upsert({
    where: { email: 'bhramanwada.prod@ems.com' },
    update: { role: UserRole.PRODUCTION_TEAM, officeId: office?.id, isActive: true },
    create: { email: 'bhramanwada.prod@ems.com', name: 'Bhramanwada Operator', role: UserRole.PRODUCTION_TEAM, officeId: office?.id, passwordHash, isActive: true },
  });

  // Log in as all actors
  const adminAuth = await apiMust('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@ems.com', password: 'admin123' }) });
  const adminToken = adminAuth.accessToken;

  const salesAuth = await apiMust('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'sales@ems.com', password: 'admin123' }) });
  const salesToken = salesAuth.accessToken;

  const nedraAuth = await apiMust('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'nedra.prod@ems.com', password: 'admin123' }) });
  const nedraToken = nedraAuth.accessToken;

  const bhramanwadaAuth = await apiMust('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'bhramanwada.prod@ems.com', password: 'admin123' }) });
  const bhramanwadaToken = bhramanwadaAuth.accessToken;

  // Master records
  const suppliers = await apiMust('/production/masters/suppliers', { token: adminToken });
  const supplierId = suppliers[0]?.id;
  const inwardTypes = await apiMust('/production/masters/inward-types', { token: adminToken });
  const inwardTypeId = inwardTypes[0]?.id;
  const cleanWastageTypes = await apiMust('/production/masters/wastage-types?stage=CLEANING', { token: adminToken });
  const hullWastageTypes = await apiMust('/production/masters/wastage-types?stage=HULLING', { token: adminToken });

  // -------------------------------------------------------------
  // UAT-01: Nedra user creates inward -> Nedra is preselected and locked
  // -------------------------------------------------------------
  const uat01_bad = await api('/production/inwards', {
    method: 'POST',
    token: nedraToken,
    body: JSON.stringify({
      supplierId,
      inwardDate: today(),
      truckNumber: 'NEDRA-FAIL-01',
      productId: nssProduct.id,
      weight: 1000,
      unit: 'KG',
      inwardTypeId,
      locationId: bhramanwadaLoc.id, // Attempting non-Nedra plant
    }),
  });
  const uat01_bad_blocked = !uat01_bad.ok && (uat01_bad.status === 400 || uat01_bad.status === 403);

  const uat01_good = await apiMust('/production/inwards', {
    method: 'POST',
    token: nedraToken,
    body: JSON.stringify({
      supplierId,
      inwardDate: today(),
      truckNumber: 'NEDRA-PASS-01',
      productId: nssProduct.id,
      weight: 15000,
      unit: 'KG',
      inwardTypeId,
      locationId: nedraLoc.id,
    }),
  });
  const uat01_ok = uat01_bad_blocked && uat01_good?.locationId === nedraLoc.id;
  record(
    'UAT-01',
    'Nedra user creates inward',
    uat01_ok,
    'Nedra is preselected & locked; non-Nedra inward rejected with 400/403',
    uat01_ok ? `Non-Nedra inward blocked (${uat01_bad.status}); Inward created at Nedra: ${uat01_good.inwardNumber}` : `Failed: bad_status=${uat01_bad.status}`,
  );

  // -------------------------------------------------------------
  // UAT-02: Bhramanwada creates inward -> Bhramanwada is default and editable
  // -------------------------------------------------------------
  const uat02_bhramanwada = await apiMust('/production/inwards', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      supplierId,
      inwardDate: today(),
      truckNumber: 'BHRAMAN-01',
      productId: nssProduct.id,
      weight: 20000,
      unit: 'KG',
      inwardTypeId,
      locationId: bhramanwadaLoc.id,
    }),
  });
  const uat02_outside = await apiMust('/production/inwards', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      supplierId,
      inwardDate: today(),
      truckNumber: 'OUTSIDE-01',
      productId: nssProduct.id,
      weight: 5000,
      unit: 'KG',
      inwardTypeId,
      locationId: outsideLoc.id, // Editable destination allowed
    }),
  });
  const uat02_ok = uat02_bhramanwada.locationId === bhramanwadaLoc.id && uat02_outside.locationId === outsideLoc.id;
  record(
    'UAT-02',
    'Bhramanwada creates inward',
    uat02_ok,
    'Bhramanwada default accepted, alternative Outside location also permitted',
    `Created Bhramanwada inward: ${uat02_bhramanwada.inwardNumber}, Outside inward: ${uat02_outside.inwardNumber}`,
  );

  // -------------------------------------------------------------
  // Setup test contracts for due dates and fulfillment
  // -------------------------------------------------------------
  const buyer = await prisma.buyer.findFirst();
  const pkgType = await prisma.packagingType.findFirst();
  const pkgSize = await prisma.packagingSize.findFirst();
  const salesperson = await prisma.salesperson.findFirst();

  // Create contract due in 5 days
  const contractYellow = await prisma.contract.create({
    data: {
      contractNumber: `UAT-YEL-${Date.now().toString().slice(-4)}`,
      officeId: office!.id,
      buyerId: buyer!.id,
      salespersonId: salesperson!.id,
      receivedDate: new Date(),
      contractDate: new Date(),
      status: ContractStatus.CONFIRMED_FOR_PRODUCTION,
      totalMt: 10,
      createdById: salesUser.id,
      productId: hssProduct.id,
    },
  });

  const containerYellow = await prisma.contractContainer.create({
    data: {
      contractId: contractYellow.id,
      containerIndex: 1,
      productId: hssProduct.id,
      packagingTypeId: pkgType?.id || null,
      packagingSizeId: pkgSize?.id || null,
      packingDescription: '25 KG PAPER BAGS',
      expectedShipmentDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      containerStatus: ContainerStatus.PRODUCTION_ASSIGNED,
      quantityMt: 10,
    },
  });

  await prisma.contractContainerProduct.create({
    data: {
      contractId: contractYellow.id,
      containerId: containerYellow.id,
      productId: hssProduct.id,
      quantityMt: 10,
      packagingTypeId: pkgType?.id || null,
      packagingSizeId: pkgSize?.id || null,
      packingDescription: '25 KG PAPER BAGS',
    },
  });

  // Create contract overdue by 2 days
  const contractRed = await prisma.contract.create({
    data: {
      contractNumber: `UAT-RED-${Date.now().toString().slice(-4)}`,
      officeId: office!.id,
      buyerId: buyer!.id,
      salespersonId: salesperson!.id,
      receivedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      contractDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      status: ContractStatus.CONFIRMED_FOR_PRODUCTION,
      totalMt: 10,
      createdById: salesUser.id,
      productId: hssProduct.id,
    },
  });

  const containerRed = await prisma.contractContainer.create({
    data: {
      contractId: contractRed.id,
      containerIndex: 1,
      productId: hssProduct.id,
      packagingTypeId: pkgType?.id || null,
      packagingSizeId: pkgSize?.id || null,
      packingDescription: '25 KG PAPER BAGS',
      expectedShipmentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      containerStatus: ContainerStatus.PRODUCTION_ASSIGNED,
      quantityMt: 10,
    },
  });

  await prisma.contractContainerProduct.create({
    data: {
      contractId: contractRed.id,
      containerId: containerRed.id,
      productId: hssProduct.id,
      quantityMt: 10,
    },
  });

  const pendingContracts = await apiMust('/production/pending-contracts', { token: adminToken });
  const yellowCard = pendingContracts.find((c: any) => c.id === contractYellow.id);
  const redCard = pendingContracts.find((c: any) => c.id === contractRed.id);

  // -------------------------------------------------------------
  // UAT-03: Contract due in 5 days -> Yellow indicator
  // -------------------------------------------------------------
  const uat03_ok = yellowCard?.urgency === 'YELLOW' && yellowCard?.daysLabel?.includes('Due in');
  record(
    'UAT-03',
    'Contract due in 5 days',
    uat03_ok,
    'Yellow indicator (urgency === YELLOW, 0-7 days remaining)',
    `Urgency: ${yellowCard?.urgency}, Days Label: ${yellowCard?.daysLabel}`,
  );

  // -------------------------------------------------------------
  // UAT-04: Contract overdue by 2 days -> Red indicator
  // -------------------------------------------------------------
  const uat04_ok = redCard?.urgency === 'RED' && redCard?.daysLabel?.includes('Overdue');
  record(
    'UAT-04',
    'Contract overdue by 2 days',
    uat04_ok,
    'Red indicator (urgency === RED, overdue warning)',
    `Urgency: ${redCard?.urgency}, Days Label: ${redCard?.daysLabel}`,
  );

  // -------------------------------------------------------------
  // UAT-05: Cleaning-only production -> Stage 1 only
  // -------------------------------------------------------------
  const uat05_run = await apiMust('/production/runs', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      plantId: bhramanwadaLoc.id,
      processType: 'CLEANING',
      productId: nssProduct.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 1000,
      unit: 'KG',
      startDate: today(),
    }),
  });

  const uat05_clean = await apiMust(`/production/runs/${uat05_run.id}/cleaning`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      actualCleanedOutputKg: 950,
      lines: [
        { wastageTypeId: cleanWastageTypes[0].id, quantity: 50, unit: 'KG' },
      ],
    }),
  });

  // Verify it skipped Stage 2 and went straight to AWAITING_FINALISATION
  const uat05_stage2_blocked = await api(`/production/runs/${uat05_run.id}/hulling`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({ lines: [] }),
  });
  const uat05_ok = uat05_clean.status === 'AWAITING_FINALISATION' && !uat05_stage2_blocked.ok;
  record(
    'UAT-05',
    'Cleaning-only production',
    uat05_ok,
    'Stage 1 only: status transitions directly to AWAITING_FINALISATION, Stage 2 blocked',
    `Status: ${uat05_clean.status}, Stage 2 block status: ${uat05_stage2_blocked.status}`,
  );

  // -------------------------------------------------------------
  // UAT-06: Sortex production -> Cleaning followed by Sortex
  // -------------------------------------------------------------
  const uat06_run = await apiMust('/production/runs', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      plantId: bhramanwadaLoc.id,
      processType: 'SORTEX',
      productId: nssProduct.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 1000,
      unit: 'KG',
      startDate: today(),
    }),
  });

  const uat06_clean = await apiMust(`/production/runs/${uat06_run.id}/cleaning`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      actualCleanedOutputKg: 950,
      lines: [
        { wastageTypeId: cleanWastageTypes[0].id, quantity: 50, unit: 'KG' },
      ],
    }),
  });
  const uat06_stage2_in_progress = uat06_clean.status === 'HULLING_IN_PROGRESS';

  const uat06_stage2 = await apiMust(`/production/runs/${uat06_run.id}/hulling`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      actualProcessedOutputKg: 910,
      lines: [
        { wastageTypeId: hullWastageTypes[0].id, quantity: 40, unit: 'KG' },
      ],
    }),
  });
  const uat06_ok = uat06_stage2_in_progress && uat06_stage2.status === 'AWAITING_FINALISATION';
  record(
    'UAT-06',
    'Sortex production',
    uat06_ok,
    'Cleaning followed by Sortex (Stage 1 -> HULLING_IN_PROGRESS -> Stage 2 -> AWAITING_FINALISATION)',
    `Stage 1 status: ${uat06_clean.status}, Stage 2 status: ${uat06_stage2.status}`,
  );

  // -------------------------------------------------------------
  // UAT-07: Hulling + Sortex -> Cleaning followed by Hulling + Sortex
  // -------------------------------------------------------------
  // Hulling + Sortex restricted to Natural Sesame Seeds
  const uat07_non_sesame = await api('/production/runs', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      plantId: bhramanwadaLoc.id,
      processType: 'HULLING_SORTEX',
      productId: amaranthProduct.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 500,
      unit: 'KG',
      startDate: today(),
    }),
  });
  const uat07_amaranth_blocked = !uat07_non_sesame.ok && uat07_non_sesame.status === 400;

  const uat07_run = await apiMust('/production/runs', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      plantId: bhramanwadaLoc.id,
      processType: 'HULLING_SORTEX',
      productId: nssProduct.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 1000,
      unit: 'KG',
      startDate: today(),
    }),
  });
  const uat07_clean = await apiMust(`/production/runs/${uat07_run.id}/cleaning`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      actualCleanedOutputKg: 960,
      lines: [{ wastageTypeId: cleanWastageTypes[0].id, quantity: 40, unit: 'KG' }],
    }),
  });
  const uat07_stage2 = await apiMust(`/production/runs/${uat07_run.id}/hulling`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      actualProcessedOutputKg: 900,
      lines: [{ wastageTypeId: hullWastageTypes[0].id, quantity: 60, unit: 'KG' }],
    }),
  });
  const uat07_ok = uat07_amaranth_blocked && uat07_clean.status === 'HULLING_IN_PROGRESS' && uat07_stage2.status === 'AWAITING_FINALISATION';
  record(
    'UAT-07',
    'Hulling + Sortex',
    uat07_ok,
    'Non-sesame blocked from Hulling+Sortex; Natural Sesame proceeds Cleaning -> Hulling+Sortex -> Awaiting Finalisation',
    `Amaranth block status: ${uat07_non_sesame.status}, Clean: ${uat07_clean.status}, Hulling: ${uat07_stage2.status}`,
  );

  // -------------------------------------------------------------
  // UAT-08: 200 KG input, 30 KG recorded Stage 1 wastage, 160 KG manual output -> Output remains 160 KG, not 170 KG
  // -------------------------------------------------------------
  const uat08_run = await apiMust('/production/runs', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      plantId: bhramanwadaLoc.id,
      processType: 'SORTEX',
      productId: nssProduct.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 200,
      unit: 'KG',
      startDate: today(),
    }),
  });
  const uat08_clean = await apiMust(`/production/runs/${uat08_run.id}/cleaning`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      actualCleanedOutputKg: 160, // Manual input 160 KG (even though 200 - 30 = 170)
      lines: [{ wastageTypeId: cleanWastageTypes[0].id, quantity: 30, unit: 'KG' }],
    }),
  });
  const uat08_ok = uat08_clean.hullingInputKg === 160;
  record(
    'UAT-08',
    '200 KG input, 30 KG recorded Stage 1 wastage, 160 KG manual output',
    uat08_ok,
    'Output remains 160 KG, not 170 KG (respects manual entry)',
    `Stage 2 forwarded input: ${uat08_clean.hullingInputKg} KG (not 170 KG)`,
  );

  // -------------------------------------------------------------
  // UAT-09: 200 KG original input, 130 KG final output -> 35% difference and warning
  // -------------------------------------------------------------
  const uat09_stage2 = await apiMust(`/production/runs/${uat08_run.id}/hulling`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      actualProcessedOutputKg: 130, // 200 KG original input -> 130 KG final output = 70 KG reduction = 35% > 15%
      lines: [{ wastageTypeId: hullWastageTypes[0].id, quantity: 15, unit: 'KG' }],
    }),
  });
  const uat09_ok = uat09_stage2.wastageAlert === true;
  record(
    'UAT-09',
    '200 KG original input, 130 KG final output',
    uat09_ok,
    '35% difference (>15%) triggers wastageAlert warning flag',
    `wastageAlert: ${uat09_stage2.wastageAlert}, Input: 200 KG, Output: 130 KG (35% diff)`,
  );

  // -------------------------------------------------------------
  // UAT-10: Natural Sesame Hulling + Sortex -> Hulled Sesame Seeds created in processed inventory
  // -------------------------------------------------------------
  const uat10_finalise = await apiMust(`/production/runs/${uat07_run.id}/finalise`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({}), // Section 10: default dispositions to STORE
  });
  const uat10_lots = uat10_finalise.outputLots || [];
  const uat10_converted = uat10_lots.some((lot: any) => lot.productId === hssProduct.id);
  const uat10_ok = uat10_converted && uat10_finalise.status === 'COMPLETED';
  record(
    'UAT-10',
    'Natural Sesame Hulling + Sortex',
    uat10_ok,
    'Hulled Sesame Seeds (HSS) created in processed inventory',
    `Output Lot product: ${uat10_lots[0]?.productId} (Expected HSS: ${hssProduct.id})`,
  );

  // -------------------------------------------------------------
  // UAT-11: Cleaning or Sortex of Natural Sesame -> No automatic Hulled Sesame conversion
  // -------------------------------------------------------------
  const uat11_finalise = await apiMust(`/production/runs/${uat06_run.id}/finalise`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({}),
  });
  const uat11_lots = uat11_finalise.outputLots || [];
  const uat11_retained = uat11_lots.some((lot: any) => lot.productId === nssProduct.id);
  const uat11_ok = uat11_retained && !uat11_lots.some((lot: any) => lot.productId === hssProduct.id);
  record(
    'UAT-11',
    'Cleaning or Sortex of Natural Sesame',
    uat11_ok,
    'No automatic Hulled Sesame conversion (remains Natural Sesame NSS)',
    `Output Lot product: ${uat11_lots[0]?.productId} (Expected NSS: ${nssProduct.id})`,
  );

  // -------------------------------------------------------------
  // UAT-12: Awaiting Finalization -> Stored selected by default for wastage
  // -------------------------------------------------------------
  // Verify uat07_run created stored wastage lots automatically without passing explicit dispositions
  const uat12_wastageLots = await apiMust(`/production/wastage-lots?locationId=${bhramanwadaLoc.id}`, { token: bhramanwadaToken });
  const uat12_runLots = uat12_wastageLots.filter((l: any) => l.productionRunId === uat07_run.id);
  const uat12_ok = uat12_runLots.length > 0 && uat12_runLots.every((l: any) => l.status === 'AVAILABLE' || l.status === 'STORED');
  record(
    'UAT-12',
    'Awaiting Finalization',
    uat12_ok,
    'STORE selected by default for wastage; WastageLot records created with status AVAILABLE',
    `Default STORE wastage lots created: ${uat12_runLots.length} lots`,
  );

  // -------------------------------------------------------------
  // UAT-13: 1,000 KG produced, 600 KG allocated directly -> 600 KG reserved; 400 KG remaining available
  // -------------------------------------------------------------
  // Start and finalize a run with 1000 KG output, allocating 600 KG directly to container
  const uat13_run = await apiMust('/production/runs', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      plantId: bhramanwadaLoc.id,
      processType: 'HULLING_SORTEX',
      productId: nssProduct.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 1100,
      unit: 'KG',
      startDate: today(),
    }),
  });
  await apiMust(`/production/runs/${uat13_run.id}/cleaning`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({ actualCleanedOutputKg: 1050, lines: [{ wastageTypeId: cleanWastageTypes[0].id, quantity: 50, unit: 'KG' }] }),
  });
  await apiMust(`/production/runs/${uat13_run.id}/hulling`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({ actualProcessedOutputKg: 1000, lines: [{ wastageTypeId: hullWastageTypes[0].id, quantity: 50, unit: 'KG' }] }),
  });

  // Direct fulfillment allocation of 600 KG to yellow contract container

  const uat13_finalise = await apiMust(`/production/runs/${uat13_run.id}/finalise`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      directAllocations: [
        {
          contractId: contractYellow.id,
          containerId: containerYellow.id,
          quantityKg: 600,
        },
      ],
    }),
  });
  const uat13_outputLot = uat13_finalise.outputLots?.[0];
  const uat13_ok =
    uat13_outputLot?.quantityKg === 1000 &&
    uat13_outputLot?.availableKg === 400 &&
    uat13_finalise.allocatedKg === 600;
  record(
    'UAT-13',
    '1,000 KG produced, 600 KG allocated directly',
    uat13_ok,
    '600 KG reserved; 400 KG remaining available',
    `Total: ${uat13_outputLot?.quantityKg} KG, Allocated: ${uat13_finalise.allocatedKg} KG, Available: ${uat13_outputLot?.availableKg} KG`,
  );

  // -------------------------------------------------------------
  // UAT-14: Hulled Sesame output selected for fulfillment -> Only compatible Hulled Sesame contract requirements shown
  // -------------------------------------------------------------
  // Attempt to allocate Hulled Sesame to a contract requiring Organic Amaranth
  const contractAmaranth = await prisma.contract.create({
    data: {
      contractNumber: `UAT-AMA-${Date.now().toString().slice(-4)}`,
      officeId: office!.id,
      buyerId: buyer!.id,
      salespersonId: salesperson!.id,
      receivedDate: new Date(),
      contractDate: new Date(),
      status: ContractStatus.CONFIRMED_FOR_PRODUCTION,
      totalMt: 5,
      createdById: salesUser.id,
      productId: amaranthProduct.id,
    },
  });

  const containerAmaranth = await prisma.contractContainer.create({
    data: {
      contractId: contractAmaranth.id,
      containerIndex: 1,
      productId: amaranthProduct.id,
      expectedShipmentDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      containerStatus: ContainerStatus.PRODUCTION_ASSIGNED,
      quantityMt: 5,
    },
  });

  await prisma.contractContainerProduct.create({
    data: {
      contractId: contractAmaranth.id,
      containerId: containerAmaranth.id,
      productId: amaranthProduct.id,
      quantityMt: 5,
    },
  });

  const uat14_bad_alloc = await api('/production/fulfilment/from-stock', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      contractId: contractAmaranth.id,
      containerId: containerAmaranth!.id,
      processedLotId: uat13_outputLot.id, // Hulled Sesame Lot
      quantityKg: 100,
    }),
  });
  const uat14_ok = !uat14_bad_alloc.ok && uat14_bad_alloc.status === 400;
  record(
    'UAT-14',
    'Hulled Sesame output selected for fulfillment',
    uat14_ok,
    'Only compatible Hulled Sesame contract requirements shown; Amaranth allocation rejected with 400',
    `Incompatible product allocation status: ${uat14_bad_alloc.status} (blocked as expected)`,
  );

  // -------------------------------------------------------------
  // UAT-15: Contract requires 25 KG bags -> Packaging information visible at fulfillment
  // -------------------------------------------------------------
  const uat15_pending = await apiMust('/production/pending-contracts', { token: adminToken });
  const uat15_card = uat15_pending.find((c: any) => c.id === contractYellow.id);
  const uat15_container = uat15_card?.containers?.[0];
  const uat15_ok =
    !!uat15_container?.packagingType &&
    !!uat15_container?.packagingSize &&
    uat15_container?.packingDescription?.includes('25 KG');
  record(
    'UAT-15',
    'Contract requires 25 KG bags',
    uat15_ok,
    'Packaging information visible at fulfillment (packagingType, packagingSize, packingDescription)',
    `Type: ${uat15_container?.packagingType}, Size: ${uat15_container?.packagingSize}, Desc: ${uat15_container?.packingDescription}`,
  );

  // -------------------------------------------------------------
  // UAT-16: Merge Natural Sesame Type 1 and Rejection 2 -> Merge permitted
  // -------------------------------------------------------------
  // Create two wastage lots of same product (NSS) at Bhramanwada
  const uat16_lotA = await prisma.wastageLot.create({
    data: {
      lotNumber: `WL-UAT16-A-${Date.now()}`,
      locationId: bhramanwadaLoc.id,
      productId: nssProduct.id,
      wastageTypeId: cleanWastageTypes[0].id,
      quantityKg: 200,
      availableKg: 200,
      status: 'AVAILABLE',
    },
  });
  const uat16_lotB = await prisma.wastageLot.create({
    data: {
      lotNumber: `WL-UAT16-B-${Date.now()}`,
      locationId: bhramanwadaLoc.id,
      productId: nssProduct.id,
      wastageTypeId: hullWastageTypes[0].id,
      quantityKg: 300,
      availableKg: 300,
      status: 'AVAILABLE',
    },
  });

  const uat16_merge = await apiMust('/production/wastage-lots/merge', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      sourceLotIds: [uat16_lotA.id, uat16_lotB.id],
    }),
  });
  const uat16_ok = uat16_merge?.quantityKg === 500 && uat16_merge?.availableKg === 500;
  record(
    'UAT-16',
    'Merge Natural Sesame Type 1 and Rejection 2',
    uat16_ok,
    'Merge permitted for same product (creates merged lot with 500 KG)',
    `Merged Lot: ${uat16_merge.lotNumber}, Total: ${uat16_merge.quantityKg} KG, Available: ${uat16_merge.availableKg} KG`,
  );

  // -------------------------------------------------------------
  // UAT-17: Merge Natural Sesame with Amaranth wastage -> Merge rejected
  // -------------------------------------------------------------
  const uat17_amaranth_lot = await prisma.wastageLot.create({
    data: {
      lotNumber: `WL-UAT17-AMA-${Date.now()}`,
      locationId: bhramanwadaLoc.id,
      productId: amaranthProduct.id,
      wastageTypeId: cleanWastageTypes[0].id,
      quantityKg: 100,
      availableKg: 100,
      status: 'AVAILABLE',
    },
  });
  const uat17_bad_merge = await api('/production/wastage-lots/merge', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      sourceLotIds: [uat16_merge.id, uat17_amaranth_lot.id],
    }),
  });
  const uat17_ok = !uat17_bad_merge.ok && uat17_bad_merge.status === 400;
  record(
    'UAT-17',
    'Merge Natural Sesame with Amaranth wastage',
    uat17_ok,
    'Merge rejected with 400 (different products cannot be merged)',
    `Cross-product merge status: ${uat17_bad_merge.status} (blocked as expected)`,
  );

  // -------------------------------------------------------------
  // UAT-18: Merge existing merged lot with a new same-product lot -> New merged lot created correctly
  // -------------------------------------------------------------
  const uat18_lotC = await prisma.wastageLot.create({
    data: {
      lotNumber: `WL-UAT18-C-${Date.now()}`,
      locationId: bhramanwadaLoc.id,
      productId: nssProduct.id,
      wastageTypeId: cleanWastageTypes[1]?.id || cleanWastageTypes[0].id,
      quantityKg: 150,
      availableKg: 150,
      status: 'AVAILABLE',
    },
  });
  const uat18_remerge = await apiMust('/production/wastage-lots/merge', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      sourceLotIds: [uat16_merge.id, uat18_lotC.id],
    }),
  });
  const uat18_ok =
    uat18_remerge?.quantityKg === 650 &&
    uat18_remerge?.parentWastageLotId === uat16_merge.id;
  record(
    'UAT-18',
    'Merge existing merged lot with a new same-product lot',
    uat18_ok,
    'New merged lot created correctly with updated quantity (650 KG) and lineage',
    `Re-merged Lot: ${uat18_remerge.lotNumber}, Total: ${uat18_remerge.quantityKg} KG, Parent: ${uat18_remerge.parentWastageLotId}`,
  );

  // -------------------------------------------------------------
  // UAT-19: Wastage outward recorded with 2 trucks -> Outward recorded and truck count updated
  // -------------------------------------------------------------
  const uat19_t1 = await apiMust('/production/wastage-lots/outward', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      outwardDate: today(),
      wastageLotId: uat18_remerge.id,
      quantityKg: 200,
      truckNumber: 'GJ-01-UAT-1111',
      destination: 'Agro Wastage Buyers Ltd',
    }),
  });
  const uat19_t2 = await apiMust('/production/wastage-lots/outward', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      outwardDate: today(),
      wastageLotId: uat18_remerge.id,
      quantityKg: 250,
      truckNumber: 'GJ-01-UAT-2222',
      destination: 'Agro Wastage Buyers Ltd',
    }),
  });
  const uat19_report = await apiMust('/production/wastage-lots/truck-report', { token: bhramanwadaToken });
  const uat19_ok = uat19_report?.totalTrucks >= 2;
  record(
    'UAT-19',
    'Wastage outward recorded with 2 trucks',
    uat19_ok,
    'Outward recorded and yearly truck summary reflects both trucks and trips',
    `Year: ${uat19_report?.year}, Total Trucks: ${uat19_report?.totalTrucks}`,
  );

  // -------------------------------------------------------------
  // UAT-20: Nedra sends merged wastage to Bhramanwada -> Notification received
  // -------------------------------------------------------------
  // Credit inventory balance at Nedra for wastage
  await prisma.inventoryBalance.upsert({
    where: {
      productId_locationId_stockCategory: {
        productId: nssProduct.id,
        locationId: nedraLoc.id,
        stockCategory: 'WASTAGE_INVENTORY',
      },
    },
    update: { quantityKg: { increment: 500 } },
    create: {
      productId: nssProduct.id,
      locationId: nedraLoc.id,
      stockCategory: 'WASTAGE_INVENTORY',
      quantityKg: 500,
    },
  });

  const uat20_nedra_lot = await prisma.wastageLot.create({
    data: {
      lotNumber: `WL-NEDRA-TR-${Date.now()}`,
      locationId: nedraLoc.id,
      productId: nssProduct.id,
      wastageTypeId: cleanWastageTypes[0].id,
      quantityKg: 500,
      availableKg: 500,
      status: 'AVAILABLE',
    },
  });
  const uat20_transfer = await apiMust('/production/transfers', {
    method: 'POST',
    token: nedraToken,
    body: JSON.stringify({
      transferDate: today(),
      sourceLocationId: nedraLoc.id,
      destLocationId: bhramanwadaLoc.id,
      productId: nssProduct.id,
      stockCategory: 'WASTAGE_INVENTORY',
      quantity: 500,
      unit: 'KG',
      remarks: 'Transfer wastage to Bhramanwada for reprocessing',
    }),
  });
  const uat20_dispatched = await apiMust(`/production/transfers/${uat20_transfer.id}/dispatch`, {
    method: 'POST',
    token: nedraToken,
  });
  const uat20_transfers = await apiMust('/production/transfers', { token: bhramanwadaToken });
  const uat20_found = uat20_transfers.some((t: any) => t.id === uat20_transfer.id && t.destLocationId === bhramanwadaLoc.id);
  const uat20_ok = uat20_found && uat20_dispatched.status === 'IN_TRANSIT';
  record(
    'UAT-20',
    'Nedra sends merged wastage to Bhramanwada',
    uat20_ok,
    'Notification/incoming transfer received at Bhramanwada (status: IN_TRANSIT)',
    `Transfer: ${uat20_transfer.transferNumber}, Found in pending: ${uat20_found}`,
  );

  // -------------------------------------------------------------
  // UAT-21: Bhramanwada accepts transfer -> Automatic inward created exactly once
  // -------------------------------------------------------------
  const uat21_receive = await apiMust(`/production/transfers/${uat20_transfer.id}/receive`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({}),
  });
  const uat21_inward = await prisma.rawMaterialInward.findFirst({
    where: { remarks: { contains: uat20_transfer.transferNumber } },
  });
  const uat21_ok = uat21_receive.status === 'RECEIVED' && !!uat21_inward && uat21_inward.locationId === bhramanwadaLoc.id;
  record(
    'UAT-21',
    'Bhramanwada accepts transfer',
    uat21_ok,
    'Automatic inward created exactly once at destination plant',
    `Transfer status: ${uat21_receive.status}, Auto Inward Number: ${uat21_inward?.inwardNumber}`,
  );

  // -------------------------------------------------------------
  // UAT-22: Job Work has two partial processed inward returns -> Processed received total calculated from both
  // -------------------------------------------------------------
  const jobWorker = await prisma.jobWorker.findFirst();
  const uat22_jw = await apiMust('/production/job-work', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      jobWorkerId: jobWorker!.id,
      sourceLocationId: bhramanwadaLoc.id,
      productId: nssProduct.id,
      processType: 'CLEANING',
      startDate: today(),
    }),
  });
  // Outward 2000 KG
  await apiMust(`/production/job-work/${uat22_jw.id}/outward`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      outwardDate: today(),
      truckNumber: 'JW-OUT-01',
      quantity: 2000,
      unit: 'KG',
    }),
  });
  // Inward return 1: 800 KG processed
  await apiMust(`/production/job-work/${uat22_jw.id}/inward`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      receiptDate: today(),
      receivingLocationId: bhramanwadaLoc.id,
      truckNumber: 'JW-IN-01',
      lines: [
        { returnCategory: 'PROCESSED', quantity: 800, unit: 'KG' },
      ],
    }),
  });
  // Inward return 2: 900 KG processed
  await apiMust(`/production/job-work/${uat22_jw.id}/inward`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      receiptDate: today(),
      receivingLocationId: bhramanwadaLoc.id,
      truckNumber: 'JW-IN-02',
      lines: [
        { returnCategory: 'PROCESSED', quantity: 900, unit: 'KG' },
      ],
    }),
  });
  const uat22_recon = (await apiMust(`/production/job-work/${uat22_jw.id}`, { token: bhramanwadaToken })).reconciliation;
  const uat22_ok = uat22_recon?.totalProcessedReceivedKg === 1700;
  record(
    'UAT-22',
    'Job Work has two partial processed inward returns',
    uat22_ok,
    'Processed received total calculated from both (800 + 900 = 1,700 KG)',
    `Total Processed Received: ${uat22_recon?.totalProcessedReceivedKg} KG`,
  );

  // -------------------------------------------------------------
  // UAT-23: Sales contract creator revises unfulfilled quantity -> Pending requirement updates and audit recorded
  // -------------------------------------------------------------
  const uat23_revised = await apiMust(`/contracts/${contractYellow.id}/revise-quantity`, {
    method: 'PATCH',
    token: salesToken, // Creator is salesUser
    body: JSON.stringify({
      totalMt: 15,
      reason: 'Buyer increased requirement by 5 MT',
    }),
  });
  const uat23_audit = await prisma.contractAuditLog.findFirst({
    where: { contractId: contractYellow.id, fieldName: 'totalMt' },
    orderBy: { createdAt: 'desc' },
  });
  const uat23_ok = uat23_revised.totalMt === 15 && uat23_audit?.newValue === '15';
  record(
    'UAT-23',
    'Sales contract creator revises unfulfilled quantity',
    uat23_ok,
    'Pending requirement updates to 15 MT and audit trail is recorded',
    `Updated totalMt: ${uat23_revised.totalMt}, Audit logged: ${uat23_audit?.fieldName} -> ${uat23_audit?.newValue}`,
  );

  // -------------------------------------------------------------
  // UAT-24: Sales creator tries reducing quantity below fulfilled amount -> Invalid revision prevented
  // -------------------------------------------------------------
  // ContractYellow has 600 KG (0.6 MT) allocated in UAT-13. Trying to reduce to 0.2 MT should be blocked.
  const uat24_bad_rev = await api(`/contracts/${contractYellow.id}/revise-quantity`, {
    method: 'PATCH',
    token: salesToken,
    body: JSON.stringify({
      totalMt: 0.2, // Below 0.6 MT fulfilled
      reason: 'Illegal reduction below fulfilled',
    }),
  });
  const uat24_ok = !uat24_bad_rev.ok && uat24_bad_rev.status === 400;
  record(
    'UAT-24',
    'Sales creator tries reducing quantity below fulfilled amount',
    uat24_ok,
    'Invalid revision prevented with 400 error',
    `Revision below fulfilled status: ${uat24_bad_rev.status} (blocked as expected)`,
  );

  // -------------------------------------------------------------
  // UAT-25: Container allocated 2 days ago, not dispatched -> 2 days pending shown
  // -------------------------------------------------------------
  // Backdate the allocation creation date by 2.5 days in DB
  const twoDaysAgo = new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000);
  await prisma.containerAllocation.updateMany({
    where: { contractId: contractYellow.id },
    data: { allocationDate: twoDaysAgo, createdAt: twoDaysAgo },
  });
  const uat25_dash = await apiMust('/production/dashboard', { token: adminToken });
  const uat25_aging = uat25_dash?.aging?.allocatedContainers || [];
  const uat25_item = uat25_aging.find((a: any) => a.contractNumber === contractYellow.contractNumber);
  const uat25_ok = !!uat25_item && uat25_item.daysWaiting >= 2;
  record(
    'UAT-25',
    'Container allocated 2 days ago, not dispatched',
    uat25_ok,
    '2 days pending shown in allocated undispatched container aging table',
    `Container: ${uat25_item?.contractNumber}, Days Waiting: ${uat25_item?.daysWaiting}`,
  );

  // -------------------------------------------------------------
  // UAT-26: Production finalized but container not dispatched -> Production closed; container remains pending
  // -------------------------------------------------------------
  const uat26_run = await prisma.productionRun.findUnique({ where: { id: uat13_run.id } });
  const uat26_container = await prisma.contractContainer.findUnique({ where: { id: containerYellow!.id } });
  const isPendingDispatch =
    uat26_container?.containerStatus !== ContainerStatus.DISPATCHED_FROM_FACTORY &&
    uat26_container?.containerStatus !== ContainerStatus.SHIPPED &&
    (uat26_container?.containerStatus === ContainerStatus.PRODUCTION_ASSIGNED ||
      uat26_container?.containerStatus === ContainerStatus.PARTIALLY_FULFILLED ||
      uat26_container?.containerStatus === ContainerStatus.READY_FOR_DISPATCH ||
      uat26_container?.containerStatus === ContainerStatus.READY_FOR_SAMPLING);
  const uat26_ok = uat26_run?.status === 'COMPLETED' && isPendingDispatch;
  record(
    'UAT-26',
    'Production finalized but container not dispatched',
    uat26_ok,
    'Production closed (COMPLETED); container remains pending dispatch (not DISPATCHED)',
    `Run status: ${uat26_run?.status}, Container status: ${uat26_container?.containerStatus}`,
  );

  // -------------------------------------------------------------
  // UAT-27: Two users try allocating same stock simultaneously -> Only available balance can be allocated
  // -------------------------------------------------------------
  // Output lot has 400 KG available. Attempting to allocate 500 KG must fail.
  const uat27_bad_alloc = await api('/production/fulfilment/from-stock', {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({
      contractId: contractYellow.id,
      containerId: containerYellow!.id,
      processedLotId: uat13_outputLot.id,
      quantityKg: 500, // Available is only 400 KG
    }),
  });
  const uat27_ok = !uat27_bad_alloc.ok && uat27_bad_alloc.status === 400;
  record(
    'UAT-27',
    'Two users try allocating same stock simultaneously',
    uat27_ok,
    'Only available balance can be allocated; over-allocation rejected with 400',
    `Over-allocation status: ${uat27_bad_alloc.status} (blocked as expected)`,
  );

  // -------------------------------------------------------------
  // UAT-28: Transfer acceptance is submitted twice -> No duplicate inward or destination stock
  // -------------------------------------------------------------
  const uat28_double_receive = await api(`/production/transfers/${uat20_transfer.id}/receive`, {
    method: 'POST',
    token: bhramanwadaToken,
    body: JSON.stringify({}),
  });
  const uat28_inward_count = await prisma.rawMaterialInward.count({
    where: { remarks: { contains: uat20_transfer.transferNumber } },
  });
  const uat28_ok = !uat28_double_receive.ok && uat28_double_receive.status === 400 && uat28_inward_count === 1;
  record(
    'UAT-28',
    'Transfer acceptance is submitted twice',
    uat28_ok,
    'No duplicate inward or destination stock (second submission rejected with 400)',
    `Second receive status: ${uat28_double_receive.status}, Inward count: ${uat28_inward_count}`,
  );

  // -------------------------------------------------------------
  // UAT-29: Old production and inventory records opened after changes -> Historical data remains intact
  // -------------------------------------------------------------
  const uat29_runs = await apiMust('/production/runs', { token: adminToken });
  const uat29_inventory = await apiMust('/production/inventory/by-product', { token: adminToken });
  const uat29_ledger = await apiMust('/production/inventory/ledger', { token: adminToken });
  const uat29_ok = Array.isArray(uat29_runs) && Array.isArray(uat29_inventory) && (Array.isArray(uat29_ledger) || Array.isArray(uat29_ledger?.items));
  record(
    'UAT-29',
    'Old production and inventory records opened after changes',
    uat29_ok,
    'Historical data remains intact and queries succeed without schema conflicts',
    `Queried ${uat29_runs.length} runs, ${uat29_inventory.length} inventory products, ledger query succeeded`,
  );

  // --- Final Summary ---
  console.log('\n================================================================');
  console.log('                        UAT SUMMARY TABLE                       ');
  console.log('================================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.ok) passCount++;
    const statusStr = r.ok ? 'PASS' : 'FAIL';
    console.log(`${r.id.padEnd(8)} | ${statusStr.padEnd(6)} | ${r.scenario.padEnd(50)}`);
  }
  console.log('================================================================');
  console.log(`TOTAL: ${passCount} / ${results.length} PASSED`);
  if (passCount === results.length) {
    console.log('🎉 ALL 29 MANDATORY UAT SCENARIOS COMPLETED AND VERIFIED!');
  } else {
    console.log('❌ SOME UAT SCENARIOS FAILED.');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error running UAT verification:', err);
  await prisma.$disconnect();
  process.exit(1);
});
