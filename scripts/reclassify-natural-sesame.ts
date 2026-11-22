/**
 * ERP Changes 22.11.26 §2.1/§2.4 data correction.
 * "Natural Sesame Seeds (Processed)" is not a valid finished product. Unallocated processed
 * lots of Natural Sesame (from Cleaning-only / Sortex-only runs) are moved back to
 * Raw / Awaiting Factory Processing stock — same product, same plant, same quantity.
 * Lot rows, runs and ledger history are kept (lot status RECLASSIFIED_AWAITING) and every
 * move is audited. Allocated lots are never touched (reported only).
 *
 *   Dry run (default):  node dist/scripts/reclassify-natural-sesame.js
 *   Apply:              node dist/scripts/reclassify-natural-sesame.js --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function nextTxn(tx: any) {
  const prefix = `LED-${new Date().getFullYear()}-`;
  const latest = await tx.inventoryLedgerEntry.findFirst({ where: { txnNumber: { startsWith: prefix } }, orderBy: { txnNumber: 'desc' } });
  const n = latest ? (parseInt(latest.txnNumber.split('-').pop() || '0', 10) || 0) + 1 : 1;
  return `${prefix}${String(n).padStart(5, '0')}`;
}

async function adjust(tx: any, productId: string, locationId: string, stockCategory: string, delta: number) {
  const key = { productId_locationId_stockCategory: { productId, locationId, stockCategory } };
  const row = await tx.inventoryBalance.findUnique({ where: key });
  const next = Math.round(((row?.quantityKg ?? 0) + delta) * 1000) / 1000;
  if (next < -0.0001) throw new Error(`${stockCategory} balance would go negative (${row?.quantityKg ?? 0} + ${delta})`);
  await tx.inventoryBalance.upsert({ where: key, create: { productId, locationId, stockCategory, quantityKg: Math.max(0, next) }, update: { quantityKg: Math.max(0, next) } });
  return Math.max(0, next);
}

async function main() {
  const nss = await prisma.product.findMany({
    where: { OR: [{ code: 'NSS' }, { name: { contains: 'Natural Sesame', mode: 'insensitive' } }] },
    select: { id: true, code: true, name: true },
  });
  const lots = await prisma.processedOutputLot.findMany({
    where: { productId: { in: nss.map((p) => p.id) }, status: 'AVAILABLE', availableKg: { gt: 0.001 } },
    include: { productionRun: { select: { productionNumber: true, processType: true } }, plant: { select: { name: true } } },
    orderBy: { completionDate: 'asc' },
  });
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — Natural Sesame processed lots with stock: ${lots.length}`);
  let moved = 0, skipped = 0, kg = 0;
  for (const lot of lots) {
    const allocated = await prisma.containerAllocation.count({ where: { processedLotId: lot.id, status: { in: ['ACTIVE', 'DISPATCHED'] } } });
    const label = `${lot.lotNumber} (${lot.productionRun?.productionNumber ?? '—'} ${lot.processType}, ${lot.plant?.name}) ${lot.availableKg} KG`;
    if (allocated) { console.log(`  SKIP   ${label}: allocated to a container`); skipped++; continue; }
    if (!apply) { console.log(`  WOULD MOVE ${label} → Raw / Awaiting Factory Processing`); moved++; kg += lot.availableKg; continue; }
    try {
      await prisma.$transaction(async (tx) => {
        await adjust(tx, lot.productId, lot.plantId, 'PROCESSED_AVAILABLE', -lot.availableKg);
        const bal = await adjust(tx, lot.productId, lot.plantId, 'RAW_MATERIAL', lot.availableKg);
        await tx.inventoryLedgerEntry.create({
          data: {
            txnNumber: await nextTxn(tx), txnType: 'RECLASSIFICATION', productId: lot.productId, stockCategory: 'RAW_MATERIAL',
            sourceLocationId: lot.plantId, destLocationId: lot.plantId, quantityInKg: lot.availableKg, quantityOutKg: lot.availableKg,
            balanceKg: bal, referenceType: 'PROCESSED_LOT', referenceId: lot.id,
            remarks: `ERP 22.11.26 §2.1: ${lot.lotNumber} Natural Sesame is not a finished product — moved to Raw / Awaiting Factory Processing`,
          },
        });
        await tx.processedOutputLot.update({ where: { id: lot.id }, data: { availableKg: 0, status: 'RECLASSIFIED_AWAITING' } });
        if (lot.productionRunId) {
          await tx.productionRun.update({ where: { id: lot.productionRunId }, data: { outputStockCategory: 'RAW_MATERIAL' } });
        }
        await tx.productionAuditLog.create({
          data: { module: 'INVENTORY', recordType: 'ProcessedOutputLot', recordNumber: lot.lotNumber, action: 'RECLASSIFIED_TO_AWAITING',
            fieldName: 'stockCategory', oldValue: `PROCESSED_AVAILABLE ${lot.availableKg} KG`, newValue: `RAW_MATERIAL ${lot.availableKg} KG`,
            reason: 'ERP Changes 22.11.26 §2.1/§2.4 — Natural Sesame Seeds (Processed) is not a valid finished product' },
        });
      });
      console.log(`  MOVED  ${label}`); moved++; kg += lot.availableKg;
    } catch (e) {
      console.log(`  ERROR  ${label}: ${(e as Error).message}`); skipped++;
    }
  }
  console.log(`${apply ? 'Moved' : 'Would move'}: ${moved} lot(s), ${Math.round(kg * 1000) / 1000} KG; skipped: ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
