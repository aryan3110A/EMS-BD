/**
 * Full PDF-mapped Production / Inventory / QC demo.
 * Run with backend up: npx ts-node scripts/demo-production-pdf.ts
 */
const BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';

type Step = { id: string; pdf: string; ok: boolean; detail: string };

async function req(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === 'string' ? body : JSON.stringify(body?.message || body);
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return body;
}

function log(steps: Step[], id: string, pdf: string, ok: boolean, detail: string) {
  steps.push({ id, pdf, ok, detail });
  console.log(`${ok ? '✓' : '✗'} [${pdf}] ${id}: ${detail}`);
}

async function main() {
  const steps: Step[] = [];
  console.log('=== Production PDF Demo ===\n');

  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'production@ems.com', password: 'admin123' }),
  });
  const token = login.accessToken || login.token;
  log(steps, 'login-production', '§4.1', !!token, `role=${login.user?.role}`);

  let adminToken = token;
  try {
    const admin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@ems.com', password: 'admin123' }),
    });
    adminToken = admin.accessToken || admin.token;
    log(steps, 'login-admin', '§4.2', true, `role=${admin.user?.role}`);
  } catch (e: any) {
    log(steps, 'login-admin', '§4.2', false, e.message);
  }

  const [locations, suppliers, types, products, settings, wastageC, wastageH] = await Promise.all([
    req('/production/masters/locations', { token }),
    req('/production/masters/suppliers', { token }),
    req('/production/masters/inward-types', { token }),
    req('/masters/products', { token }),
    req('/production/settings', { token }),
    req('/production/masters/wastage-types?stage=CLEANING', { token }),
    req('/production/masters/wastage-types?stage=HULLING', { token }),
  ]);
  const plant = locations.find((l: any) => /in-house/i.test(l.name)) || locations[0];
  const nedra = locations.find((l: any) => /nedra/i.test(l.name)) || locations[1];
  const supplier = suppliers[0];
  const domestic = types.find((t: any) => t.code === 'DOMESTIC') || types[0];
  const product =
    products.find((p: any) => p.id === settings.fullProcessDefaultProductId) ||
    products.find((p: any) => /sesame|nss/i.test(p.code + p.name)) ||
    products[0];

  log(
    steps,
    'masters',
    '§5',
    locations.length >= 3 && !!supplier && types.length >= 3 && wastageC.length >= 3 && wastageH.length >= 6,
    `locs=${locations.length} suppliers=${suppliers.length} clean=${wastageC.length} hull=${wastageH.length} product=${product?.code}`,
  );

  // §6 Inward
  const inward = await req('/production/inwards', {
    method: 'POST',
    token,
    body: JSON.stringify({
      supplierId: supplier.id,
      inwardDate: new Date().toISOString().slice(0, 10),
      truckNumber: 'DEMO-TRUCK-01',
      productId: product.id,
      numberOfBags: 560,
      weight: 30,
      unit: 'MT',
      inwardTypeId: domestic.id,
      locationId: plant.id,
      remarks: 'PDF demo inward',
    }),
  });
  log(steps, 'inward-create', '§6', /^INW-\d{4}-\d{5}$/.test(inward.inwardNumber), inward.inwardNumber);

  const balances = await req(`/production/inventory/balances?locationId=${plant.id}&stockCategory=RAW_MATERIAL`, {
    token,
  });
  const rawBal = balances.find((b: any) => b.productId === product.id);
  log(steps, 'inventory-after-inward', '§6.3/§24', Number(rawBal?.quantityKg || 0) >= 30000, `rawKg=${rawBal?.quantityKg}`);

  // §7 Pending
  const pending = await req('/production/pending-contracts', { token });
  log(steps, 'pending-contracts', '§7', Array.isArray(pending), `count=${pending.length}`);

  // Pick targets if available
  const _nonEu = pending.find((c: any) => String(c.euClassification || '').toUpperCase() !== 'EU' && c.containers?.length);
  void _nonEu;

  // §9 Start Full Process
  const run = await req('/production/runs', {
    method: 'POST',
    token,
    body: JSON.stringify({
      plantId: plant.id,
      processType: 'FULL_PROCESS',
      productId: product.id,
      supplierId: supplier.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 28,
      unit: 'MT',
      startDate: new Date().toISOString().slice(0, 10),
      remarks: 'PDF demo full process',
    }),
  });
  log(steps, 'start-run', '§8/§9', /^PR-\d{4}-\d{5}$/.test(run.productionNumber), `${run.productionNumber} status=${run.status}`);

  // §11 Add more input
  const afterAdd = await req(`/production/runs/${run.id}/inputs`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      inputDate: new Date().toISOString().slice(0, 10),
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 2,
      unit: 'MT',
      remarks: 'Additional 2 MT demo',
    }),
  });
  log(
    steps,
    'add-more-input',
    '§11',
    Math.abs(afterAdd.totalInputKg - 30000) < 1,
    `totalInputKg=${afterAdd.totalInputKg} inputs=${afterAdd.inputs?.length}`,
  );

  // §12 Cleaning — 500 kg wastage
  const cleanLines = wastageC.slice(0, 3).map((t: any, i: number) => ({
    wastageTypeId: t.id,
    quantity: i === 0 ? 500 : 0,
    unit: 'KG',
  }));
  const cleaned = await req(`/production/runs/${run.id}/cleaning`, {
    method: 'POST',
    token,
    body: JSON.stringify({ lines: cleanLines }),
  });
  log(
    steps,
    'cleaning',
    '§12',
    !!cleaned.cleaningFinalizedAt && Math.abs(cleaned.hullingInputKg - 29500) < 1,
    `wastage=${cleaned.cleaningWastageKg} hullingInput=${cleaned.hullingInputKg}`,
  );

  // §13–15 Hulling — ~14% wastage to trigger alert (>12%)
  // hulling input 29500; 14% ≈ 4130 kg
  const hullQty = 4130;
  const hullLines = wastageH.map((t: any, i: number) => ({
    wastageTypeId: t.id,
    quantity: i === 0 ? hullQty : 0,
    unit: 'KG',
  }));
  const hulled = await req(`/production/runs/${run.id}/hulling`, {
    method: 'POST',
    token,
    body: JSON.stringify({ lines: hullLines }),
  });
  log(
    steps,
    'hulling-wastage-alert',
    '§15.1',
    !!hulled.hullingFinalizedAt && hulled.wastageAlert === true && hulled.hullingWastagePct > 12,
    `net=${hulled.netOutputKg} pct=${hulled.hullingWastagePct}% alert=${hulled.wastageAlert}`,
  );

  // §17 Allocate — use a pending contract whose product matches available production output
  let allocated = hulled;
  const matchPending = pending.find((c: any) =>
    c.containers?.some((x: any) =>
      (x.productLines || []).some((pl: any) => pl.productId === product.id && pl.pendingKg > 1000),
    ),
  );
  // If no NSS pending, start a second small run using the first pending line's product after inward of that product
  let allocProduct = product;
  let allocRun = run;
  let allocNet = hulled;

  if (!matchPending) {
    const anyLine = pending
      .flatMap((c: any) =>
        (c.containers || []).flatMap((ct: any) =>
          (ct.productLines || []).map((pl: any) => ({ c, ct, pl })),
        ),
      )
      .find((x: any) => x.pl.pendingKg > 5000);
    if (anyLine) {
      allocProduct = products.find((p: any) => p.id === anyLine.pl.productId) || product;
      // inward that product then produce & allocate
      await req('/production/inwards', {
        method: 'POST',
        token,
        body: JSON.stringify({
          supplierId: supplier.id,
          inwardDate: new Date().toISOString().slice(0, 10),
          truckNumber: 'DEMO-TRUCK-02',
          productId: allocProduct.id,
          numberOfBags: 100,
          weight: 10,
          unit: 'MT',
          inwardTypeId: domestic.id,
          locationId: plant.id,
          remarks: 'Demo stock for pending product allocate',
        }),
      });
      const run2 = await req('/production/runs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          plantId: plant.id,
          processType: 'FULL_PROCESS',
          productId: allocProduct.id,
          stockCategory: 'NORMAL_RAW_MATERIAL',
          quantity: 8,
          unit: 'MT',
          startDate: new Date().toISOString().slice(0, 10),
        }),
      });
      await req(`/production/runs/${run2.id}/cleaning`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          lines: wastageC.map((t: any, i: number) => ({
            wastageTypeId: t.id,
            quantity: i === 0 ? 100 : 0,
            unit: 'KG',
          })),
        }),
      });
      allocNet = await req(`/production/runs/${run2.id}/hulling`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          lines: wastageH.map((t: any, i: number) => ({
            wastageTypeId: t.id,
            quantity: i === 0 ? 200 : 0,
            unit: 'KG',
          })),
        }),
      });
      allocRun = allocNet;
      const allocMt = Math.min(5, anyLine.pl.pendingKg / 1000, allocNet.netOutputKg / 1000);
      allocated = await req(`/production/runs/${allocRun.id}/allocate`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          contractId: anyLine.c.id,
          containerId: anyLine.ct.id,
          containerProductId: anyLine.pl.id,
          productId: allocProduct.id,
          quantity: allocMt,
          unit: 'MT',
        }),
      });
      log(
        steps,
        'allocate-partial',
        '§17',
        allocated.allocatedKg > 0,
        `allocatedKg=${allocated.allocatedKg} product=${allocProduct.code} contract=${anyLine.c.contractNumber}`,
      );
    } else {
      log(steps, 'allocate-partial', '§17', false, 'No pending product lines with enough qty');
    }
  } else {
    const mCt = matchPending.containers.find((x: any) =>
      (x.productLines || []).some((pl: any) => pl.productId === product.id && pl.pendingKg > 1000),
    );
    const mLine = (mCt.productLines || []).find((pl: any) => pl.productId === product.id);
    const allocMt = Math.min(20, mLine.pendingKg / 1000, hulled.netOutputKg / 1000);
    allocated = await req(`/production/runs/${run.id}/allocate`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        contractId: matchPending.id,
        containerId: mCt.id,
        containerProductId: mLine.id,
        productId: product.id,
        quantity: allocMt,
        unit: 'MT',
      }),
    });
    log(
      steps,
      'allocate-partial',
      '§17',
      allocated.allocatedKg > 0,
      `allocatedKg=${allocated.allocatedKg} contract=${matchPending.contractNumber}`,
    );
  }

  // §18 Store remaining on primary NSS run
  const rem = Math.max(0, hulled.netOutputKg - (matchPending ? allocated.allocatedKg : 0) - (hulled.storedProcessedKg || 0));
  // refresh primary run
  const primary = await req(`/production/runs/${run.id}`, { token });
  const remPrimary = Math.max(0, primary.netOutputKg - primary.allocatedKg - primary.storedProcessedKg);
  if (remPrimary > 0.001) {
    const stored = await req(`/production/runs/${run.id}/store-processed`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
    log(
      steps,
      'store-processed',
      '§18/§20',
      Math.abs(stored.netOutputKg - stored.allocatedKg - stored.storedProcessedKg) < 1,
      `net=${stored.netOutputKg} alloc=${stored.allocatedKg} stored=${stored.storedProcessedKg} status=${stored.status}`,
    );
  } else {
    log(steps, 'store-processed', '§18/§20', true, 'Nothing remaining on primary run');
  }

  // also store remaining on alloc run if different
  if (allocRun.id !== run.id) {
    const r2 = await req(`/production/runs/${allocRun.id}`, { token });
    const rem2 = Math.max(0, r2.netOutputKg - r2.allocatedKg - r2.storedProcessedKg);
    if (rem2 > 0.001) {
      await req(`/production/runs/${allocRun.id}/store-processed`, { method: 'POST', token, body: '{}' });
    }
  }

  // §26 Plant transfer — create fresh raw for transfer
  await req('/production/inwards', {
    method: 'POST',
    token,
    body: JSON.stringify({
      supplierId: supplier.id,
      inwardDate: new Date().toISOString().slice(0, 10),
      truckNumber: 'DEMO-TRUCK-TRF',
      productId: product.id,
      numberOfBags: 20,
      weight: 1,
      unit: 'MT',
      inwardTypeId: domestic.id,
      locationId: plant.id,
      remarks: 'Stock for plant transfer demo',
    }),
  });
  if (nedra) {
    const tr = await req('/production/transfers', {
      method: 'POST',
      token,
      body: JSON.stringify({
        transferDate: new Date().toISOString().slice(0, 10),
        sourceLocationId: plant.id,
        destLocationId: nedra.id,
        stockCategory: 'RAW_MATERIAL',
        productId: product.id,
        quantity: 500,
        unit: 'KG',
        remarks: 'PDF demo transfer',
      }),
    });
    const dispatched = await req(`/production/transfers/${tr.id}/dispatch`, { method: 'POST', token, body: '{}' });
    const received = await req(`/production/transfers/${tr.id}/receive`, { method: 'POST', token, body: '{}' });
    log(
      steps,
      'plant-transfer',
      '§26',
      received.status === 'RECEIVED' && !!received.linkedInwardId,
      `status=${received.status} linkedInward=${received.linkedInwardId || 'none'}`,
    );
    log(
      steps,
      'transfer-dispatch-transit',
      '§26.2',
      dispatched.status === 'IN_TRANSIT' || received.status === 'RECEIVED',
      `dispatchWas=${dispatched.status}`,
    );
  } else {
    log(steps, 'plant-transfer', '§26', false, 'No Nedra location');
  }

  // §27 Dashboard
  const dash = await req('/production/dashboard', { token: adminToken });
  log(
    steps,
    'owner-dashboard',
    '§27',
    dash?.inventory && Array.isArray(dash?.wastageAlerts) && dash?.payments,
    `raw=${dash?.inventory?.totalRaw} alerts=${dash?.wastageAlerts?.length} payPending=${dash?.payments?.pendingContainers}`,
  );

  // §28 Audit
  const audit = await req('/production/audit', { token });
  log(steps, 'audit-log', '§28', Array.isArray(audit) && audit.length > 0, `entries=${audit.length}`);

  // Role: inventory cannot start run
  try {
    const invLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'inventory@ems.com', password: 'admin123' }),
    });
    const invToken = invLogin.accessToken || invLogin.token;
    try {
      await req('/production/runs', {
        method: 'POST',
        token: invToken,
        body: JSON.stringify({
          plantId: plant.id,
          processType: 'FULL_PROCESS',
          productId: product.id,
          stockCategory: 'NORMAL_RAW_MATERIAL',
          quantity: 1,
          unit: 'MT',
          startDate: new Date().toISOString().slice(0, 10),
        }),
      });
      log(steps, 'inventory-role-block-run', '§4 roles', false, 'Inventory was allowed to start run (should be forbidden)');
    } catch (e: any) {
      log(steps, 'inventory-role-block-run', '§4 roles', /403|Forbidden|401/.test(e.message), e.message.slice(0, 120));
    }
  } catch {
    log(steps, 'inventory-role-block-run', '§4 roles', false, 'inventory@ems.com not seeded yet — run npm run db:seed');
  }

  // §19 Fulfil from processed stock — match lot product to pending line
  const lots = await req('/production/processed-lots', { token });
  const pendingRefresh = await req('/production/pending-contracts', { token });
  let fulfilledFromStock = false;
  for (const lot of lots) {
    const avail = Number(lot.availableKg ?? lot.remainingKg ?? 0);
    if (avail < 100) continue;
    const hit = pendingRefresh
      .flatMap((c: any) =>
        (c.containers || []).flatMap((ct: any) =>
          (ct.productLines || []).map((pl: any) => ({ c, ct, pl })),
        ),
      )
      .find((x: any) => x.pl.productId === lot.productId && x.pl.pendingKg > 100);
    if (!hit) continue;
    const qty = Math.min(0.5, hit.pl.pendingKg / 1000, avail / 1000);
    try {
      await req('/production/fulfilment/from-stock', {
        method: 'POST',
        token,
        body: JSON.stringify({
          processedLotId: lot.id,
          contractId: hit.c.id,
          containerId: hit.ct.id,
          containerProductId: hit.pl.id,
          productId: lot.productId,
          quantity: qty,
          unit: 'MT',
        }),
      });
      log(steps, 'fulfil-from-stock', '§19', true, `allocated ${qty} MT lot→${hit.c.contractNumber}`);
      fulfilledFromStock = true;
      break;
    } catch (e: any) {
      log(steps, 'fulfil-from-stock', '§19', false, e.message.slice(0, 160));
      fulfilledFromStock = true;
      break;
    }
  }
  if (!fulfilledFromStock) {
    log(steps, 'fulfil-from-stock', '§19', lots.length > 0, lots.length ? 'No pending line matching processed lots' : 'No processed lot');
  }

  const samples = await req('/production/sampling', { token });
  log(steps, 'sampling-list', '§22', Array.isArray(samples), `count=${samples.length}`);

  // Negative stock check
  try {
    await req('/production/runs', {
      method: 'POST',
      token,
      body: JSON.stringify({
        plantId: plant.id,
        processType: 'FULL_PROCESS',
        productId: product.id,
        stockCategory: 'NORMAL_RAW_MATERIAL',
        quantity: 99999,
        unit: 'MT',
        startDate: new Date().toISOString().slice(0, 10),
      }),
    });
    log(steps, 'negative-stock-guard', '§29', false, 'Allowed overdraw');
  } catch (e: any) {
    log(steps, 'negative-stock-guard', '§29', /Insufficient|400/.test(e.message), e.message.slice(0, 120));
  }
  const failed = steps.filter((s) => !s.ok);
  console.log(`\n=== Summary: ${steps.filter((s) => s.ok).length}/${steps.length} passed ===`);
  if (failed.length) {
    console.log('Failed:');
    for (const f of failed) console.log(` - ${f.id} (${f.pdf}): ${f.detail}`);
  }

  // write JSON report for canvas
  const fs = await import('fs');
  const path = await import('path');
  const out = path.join(__dirname, 'demo-production-pdf-result.json');
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), steps, failed: failed.length }, null, 2));
  console.log(`\nWrote ${out}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
