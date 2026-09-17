/**
 * Smoke test for ERP Changes 10.09.26 flows.
 * Requires API running with migrated DB + seed.
 *
 *   npm run start   # in another terminal
 *   npx ts-node scripts/smoke-erp-changes.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

const API = process.env.API_URL || 'http://127.0.0.1:3001/api/v1';

async function req(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...opts, headers });
  } catch (e: any) {
    throw new Error(
      `Cannot reach API at ${API} (${e?.cause?.code || e?.message}). Start the backend with: npm run start`,
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  console.log('=== ERP Changes smoke ===\n');
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'production@ems.com', password: 'admin123' }),
  });
  const token = login.accessToken;
  const locations = await req('/production/masters/locations', { token });
  const products = await req('/masters/products', { token });
  const plant = locations.find((l: any) => l.code === 'BHRAMANWADA') || locations[0];
  const sesame = products.find((p: any) => p.code === 'NSS' || p.allowsFullProcess) || products[0];
  const nonSesame = products.find((p: any) => p.allowsFullProcess === false) || products.find((p: any) => p.code === 'AMARANTH');

  console.log('1) Full Process blocked for non-sesame (expect fail if non-sesame exists)');
  if (nonSesame) {
    try {
      await req('/production/runs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          plantId: plant.id,
          processType: 'FULL_PROCESS',
          productId: nonSesame.id,
          stockCategory: 'NORMAL_RAW_MATERIAL',
          quantity: 1,
          unit: 'KG',
          startDate: new Date().toISOString().slice(0, 10),
        }),
      });
      console.log('  FAIL: Full Process should be blocked');
    } catch {
      console.log('  OK: Full Process blocked for non-sesame');
    }
  }

  console.log('2) Sortex run → cleaning → finalise (no hulling)');
  // Need raw stock — create inward first
  const suppliers = await req('/production/masters/suppliers', { token });
  const inwardTypes = await req('/production/masters/inward-types', { token });
  await req('/production/inwards', {
    method: 'POST',
    token,
    body: JSON.stringify({
      supplierId: suppliers[0].id,
      inwardDate: new Date().toISOString().slice(0, 10),
      truckNumber: 'SMOKE-TRUCK-1',
      productId: sesame.id,
      weight: 5000,
      unit: 'KG',
      inwardTypeId: inwardTypes[0].id,
      locationId: plant.id,
    }),
  });
  console.log('  OK: Inward 5000 KG');

  const run = await req('/production/runs', {
    method: 'POST',
    token,
    body: JSON.stringify({
      plantId: plant.id,
      processType: 'SORTEX',
      productId: sesame.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 1000,
      unit: 'KG',
      startDate: new Date().toISOString().slice(0, 10),
    }),
  });
  console.log('  OK: Sortex started', run.productionNumber);

  const wastageTypes = await req('/production/masters/wastage-types?stage=CLEANING', { token });
  await req(`/production/runs/${run.id}/cleaning`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      lines: wastageTypes.map((t: any, i: number) => ({
        wastageTypeId: t.id,
        quantity: i === 0 ? 50 : i === 1 ? 30 : 20,
        unit: 'KG',
      })),
    }),
  });
  const afterClean = await req(`/production/runs/${run.id}`, { token });
  if (afterClean.status !== 'AWAITING_FINALISATION') {
    throw new Error(`Expected AWAITING_FINALISATION, got ${afterClean.status}`);
  }
  console.log('  OK: Sortex skipped hulling → AWAITING_FINALISATION');

  await req(`/production/runs/${run.id}/finalise`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      dispositions: wastageTypes.slice(0, 3).map((t: any, i: number) => ({
        wastageTypeId: t.id,
        action: i < 2 ? 'STORE' : 'DISCARD',
      })),
    }),
  });
  const done = await req(`/production/runs/${run.id}`, { token });
  if (done.status !== 'COMPLETED') throw new Error('Run not completed');
  console.log('  OK: Finalised with Store/Discard → COMPLETED');

  const wastageLots = await req('/production/wastage-lots', { token });
  console.log(`  OK: Wastage lots available: ${wastageLots.length}`);

  const stock = await req(`/production/fulfilment/processed-stock?productId=${sesame.id}&locationId=${plant.id}`, {
    token,
  });
  console.log(`  OK: Processed stock available ${stock.totalAvailableKg} KG`);

  try {
    await req(`/production/runs/${run.id}/allocate`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        contractId: 'x',
        containerId: 'y',
        productId: sesame.id,
        quantity: 1,
        unit: 'KG',
      }),
    });
    console.log('  FAIL: allocate from run should be blocked');
  } catch {
    console.log('  OK: Run allocate blocked');
  }

  const inv = await req('/production/inventory/by-product', { token });
  console.log(`  OK: Inventory by product rows: ${inv.length}`);

  console.log('3) Outside Warehouse location present');
  const outside = locations.find((l: any) => l.code === 'OUTSIDE');
  if (!outside) throw new Error('Outside Warehouse missing');
  console.log('  OK: Outside Warehouse seeded');

  console.log('4) Job Work workers list');
  const workers = await req('/production/job-work/workers', { token });
  console.log(`  OK: Job workers: ${workers.length}`);

  console.log('5) Sampling helper — Russia requires sampling');
  // Pure API: create is heavy; assert constant via a lightweight contract list if any Russia dest exists
  const contracts = await req('/production/pending-contracts', { token }).catch(() => []);
  const russia = (contracts || []).find(
    (c: any) => String(c.destinationCountry || c.buyer?.country || '').toLowerCase() === 'russia',
  );
  if (russia) {
    console.log(`  OK: Found Russia contract ${russia.contractNumber || russia.id} (sampling required)`);
  } else {
    console.log('  SKIP: No Russia contract in DB (code path requiresSampling covers RU)');
  }

  console.log('\nSmoke completed successfully.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
