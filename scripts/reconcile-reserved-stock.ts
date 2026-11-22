/**
 * Data correction: release "allocated" (PROCESSED_RESERVED) stock that no longer belongs to
 * any active container allocation.
 *
 * Cause: before 22.11.26, deleting a contract put the quantity back on the processed lot but
 * did not reverse the ledger, so the reserved balance kept stock for containers that no longer
 * exist (lot totals and ledger disagreed). For every product × plant the excess of the
 * PROCESSED_RESERVED balance over the ACTIVE allocations is moved back to PROCESSED_AVAILABLE.
 * Shortfalls are only reported. Every correction is a ledger entry + audit row.
 *
 *   Dry run (default):  node dist/scripts/reconcile-reserved-stock.js
 *   Apply:              node dist/scripts/reconcile-reserved-stock.js --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const r3 = (n: number) => Math.round(n * 1000) / 1000;

async function nextTxn(tx: any) {
  const prefix = `LED-${new Date().getFullYear()}-`;
  const latest = await tx.inventoryLedgerEntry.findFirst({ where: { txnNumber: { startsWith: prefix } }, orderBy: { txnNumber: 'desc' } });
  const n = latest ? (parseInt(latest.txnNumber.split('-').pop() || '0', 10) || 0) + 1 : 1;
  return `${prefix}${String(n).padStart(5, '0')}`;
}

async function main() {
  const reserved = await prisma.inventoryBalance.findMany({
    where: { stockCategory: 'PROCESSED_RESERVED', quantityKg: { gt: 0.001 } },
    include: { product: { select: { code: true } }, location: { select: { name: true } } },
  });
  const active = await prisma.containerAllocation.findMany({
    where: { status: 'ACTIVE' },
    include: { processedLot: { select: { plantId: true } }, productionRun: { select: { plantId: true } } },
  });
  const activeKg = new Map<string, number>();
  for (const a of active) {
    const plant = a.processedLot?.plantId || a.productionRun?.plantId;
    if (!plant) continue;
    const key = `${a.productId}:${plant}`;
    activeKg.set(key, r3((activeKg.get(key) || 0) + a.quantityKg));
  }
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — reserved balances checked: ${reserved.length}`);
  for (const b of reserved) {
    const act = activeKg.get(`${b.productId}:${b.locationId}`) || 0;
    const excess = r3(b.quantityKg - act);
    const label = `${b.product.code} @ ${b.location.name}: reserved ${b.quantityKg} KG, active allocations ${act} KG`;
    if (Math.abs(excess) <= 0.001) { console.log(`  OK     ${label}`); continue; }
    if (excess < 0) { console.log(`  REPORT ${label} — shortfall ${-excess} KG (not changed)`); continue; }
    if (!apply) { console.log(`  WOULD RELEASE ${excess} KG → unassigned   (${label})`); continue; }
    await prisma.$transaction(async (tx) => {
      const avail = await tx.inventoryBalance.findUnique({
        where: { productId_locationId_stockCategory: { productId: b.productId, locationId: b.locationId, stockCategory: 'PROCESSED_AVAILABLE' } },
      });
      const newAvail = r3((avail?.quantityKg || 0) + excess);
      await tx.inventoryBalance.update({ where: { id: b.id }, data: { quantityKg: r3(b.quantityKg - excess) } });
      await tx.inventoryBalance.upsert({
        where: { productId_locationId_stockCategory: { productId: b.productId, locationId: b.locationId, stockCategory: 'PROCESSED_AVAILABLE' } },
        create: { productId: b.productId, locationId: b.locationId, stockCategory: 'PROCESSED_AVAILABLE', quantityKg: newAvail },
        update: { quantityKg: newAvail },
      });
      await tx.inventoryLedgerEntry.create({
        data: {
          txnNumber: await nextTxn(tx), txnType: 'CONTAINER_DEALLOCATION', productId: b.productId, stockCategory: 'PROCESSED_AVAILABLE',
          sourceLocationId: b.locationId, destLocationId: b.locationId, quantityInKg: excess, quantityOutKg: excess, balanceKg: newAvail,
          referenceType: 'RECONCILIATION',
          remarks: 'Correction: reserved stock of deleted contracts returned to unassigned (ledger now matches lots)',
        },
      });
      await tx.productionAuditLog.create({
        data: { module: 'INVENTORY', recordType: 'InventoryBalance', recordNumber: `${b.product.code}@${b.location.name}`,
          action: 'RESERVED_RECONCILED', fieldName: 'PROCESSED_RESERVED', oldValue: String(b.quantityKg), newValue: String(r3(b.quantityKg - excess)),
          reason: 'Allocations of deleted contracts had not been reversed in the ledger (fixed 22.11.26)' },
      });
    });
    console.log(`  RELEASED ${excess} KG → unassigned   (${label})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
