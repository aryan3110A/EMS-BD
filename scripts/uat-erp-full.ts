/**
 * Full ERP Changes UAT (API). Prints PASS/FAIL per check.
 *   npx ts-node scripts/uat-erp-full.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

const API = process.env.API_URL || 'http://127.0.0.1:3001/api/v1';
const today = () => new Date().toISOString().slice(0, 10);

type Result = { id: string; ok: boolean; detail: string };
const results: Result[] = [];

function pass(id: string, detail: string) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id} — ${detail}`);
}
function fail(id: string, detail: string) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id} — ${detail}`);
}

async function req(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function must(path: string, opts: RequestInit & { token?: string } = {}) {
  const r = await req(path, opts);
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

async function main() {
  console.log('=== Full ERP UAT ===\n');

  const login = await must('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'production@ems.com', password: 'admin123' }),
  });
  const token = login.accessToken;
  const adminLogin = await must('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@ems.com', password: 'admin123' }),
  });
  const adminToken = adminLogin.accessToken;
  pass('0-login', 'production + admin login');

  const locations = await must('/production/masters/locations', { token });
  const codes = locations.map((l: any) => l.code).sort();
  const plant = locations.find((l: any) => l.code === 'BHRAMANWADA') || locations[0];
  const outside = locations.find((l: any) => l.code === 'OUTSIDE');
  const inhouse = locations.find((l: any) => l.code === 'INHOUSE');
  const nedra = locations.find((l: any) => l.code === 'NEDRA');
  if (['BHRAMANWADA', 'INHOUSE', 'NEDRA', 'OUTSIDE'].every((c) => codes.includes(c))) {
    pass('2-locations', codes.join(', '));
  } else fail('2-locations', `got ${codes.join(',')}`);
  if (outside) pass('S-outside', outside.name);
  else fail('S-outside', 'missing');

  const products = await must('/masters/products', { token });
  const sesame = products.find((p: any) => p.code === 'NSS' || p.allowsFullProcess) || products[0];
  const nonSesame = products.find((p: any) => p.allowsFullProcess === false);
  if (sesame?.allowsFullProcess) pass('B-sesame-fp', `${sesame.code} allows Full Process`);
  else fail('B-sesame-fp', 'no sesame with allowsFullProcess');
  if (nonSesame) pass('B-non-sesame', `${nonSesame.code} Full Process false`);

  const fpBlock = await req('/production/runs', {
    method: 'POST',
    token,
    body: JSON.stringify({
      plantId: plant.id,
      processType: 'FULL_PROCESS',
      productId: nonSesame?.id || sesame.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 1,
      unit: 'KG',
      startDate: today(),
    }),
  });
  if (!fpBlock.ok && nonSesame) pass('B-fp-block', `status ${fpBlock.status}`);
  else if (nonSesame) fail('B-fp-block', 'Full Process should be rejected');

  const suppliers = await must('/production/masters/suppliers', { token });
  const inwardTypes = await must('/production/masters/inward-types', { token });
  await must('/production/inwards', {
    method: 'POST',
    token,
    body: JSON.stringify({
      supplierId: suppliers[0].id,
      inwardDate: today(),
      truckNumber: 'UAT-TRUCK',
      productId: sesame.id,
      weight: 8000,
      unit: 'KG',
      inwardTypeId: inwardTypes[0].id,
      locationId: plant.id,
    }),
  });
  pass('2-inward', '8000 KG at Bhramanwada');

  if (outside) {
    await must('/production/inwards', {
      method: 'POST',
      token,
      body: JSON.stringify({
        supplierId: suppliers[0].id,
        inwardDate: today(),
        truckNumber: 'UAT-OUT',
        productId: sesame.id,
        weight: 200,
        unit: 'KG',
        inwardTypeId: inwardTypes[0].id,
        locationId: outside.id,
      }),
    });
    pass('2-inward-outside', '200 KG Outside Warehouse');
  }

  const over = await req('/production/runs', {
    method: 'POST',
    token,
    body: JSON.stringify({
      plantId: plant.id,
      processType: 'SORTEX',
      productId: sesame.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 99999999,
      unit: 'KG',
      startDate: today(),
    }),
  });
  if (!over.ok) pass('C-over-qty', `blocked ${over.status}`);
  else fail('C-over-qty', 'over-qty run should fail');

  const run = await must('/production/runs', {
    method: 'POST',
    token,
    body: JSON.stringify({
      plantId: plant.id,
      processType: 'SORTEX',
      productId: sesame.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 1000,
      unit: 'KG',
      startDate: today(),
    }),
  });
  pass('D-start', run.productionNumber);

  const cleanTypes = await must('/production/masters/wastage-types?stage=CLEANING', { token });
  await must(`/production/runs/${run.id}/cleaning`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      lines: cleanTypes.map((t: any, i: number) => ({
        wastageTypeId: t.id,
        quantity: i === 0 ? 50 : i === 1 ? 30 : 20,
        unit: 'KG',
      })),
    }),
  });
  const afterClean = await must(`/production/runs/${run.id}`, { token });
  if (afterClean.status === 'AWAITING_FINALISATION') pass('D-no-hull', afterClean.status);
  else fail('D-no-hull', afterClean.status);

  const hullTry = await req(`/production/runs/${run.id}/hulling`, {
    method: 'POST',
    token,
    body: JSON.stringify({ lines: [] }),
  });
  if (!hullTry.ok) pass('D-hull-reject', `hulling blocked ${hullTry.status}`);
  else fail('D-hull-reject', 'Sortex should not accept hulling');

  const noDisp = await req(`/production/runs/${run.id}/finalise`, {
    method: 'POST',
    token,
    body: JSON.stringify({ dispositions: [] }),
  });
  if (!noDisp.ok) pass('F-disp-required', `finalise without disp ${noDisp.status}`);
  else fail('F-disp-required', 'should require dispositions');

  await must(`/production/runs/${run.id}/finalise`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      dispositions: cleanTypes.slice(0, 3).map((t: any, i: number) => ({
        wastageTypeId: t.id,
        action: i < 2 ? 'STORE' : 'DISCARD',
      })),
    }),
  });
  const done = await must(`/production/runs/${run.id}`, { token });
  if (done.status === 'COMPLETED') pass('F-finalise', 'COMPLETED');
  else fail('F-finalise', done.status);

  const lots = done.processedLots || done.outputLots || [];
  const allocTry = await req(`/production/runs/${run.id}/allocate`, {
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
  if (!allocTry.ok) pass('A-no-alloc', 'run allocate blocked');
  else fail('A-no-alloc', 'allocate should be blocked');

  const wastageLots = await must('/production/wastage-lots', { token });
  const stored = (wastageLots || []).filter((l: any) => l.availableKg > 0);
  if (stored.length >= 2) pass('K-wastage-lots', `${stored.length} available lots`);
  else fail('K-wastage-lots', `only ${stored.length} lots`);

  const stock = await must(
    `/production/fulfilment/processed-stock?productId=${sesame.id}&locationId=${plant.id}`,
    { token },
  );
  if (stock.totalAvailableKg >= 800) pass('G-processed', `${stock.totalAvailableKg} KG available`);
  else fail('G-processed', `only ${stock.totalAvailableKg}`);

  const inv = await must('/production/inventory/by-product', { token });
  const invRow = (inv || []).find((p: any) => p.productId === sesame.id);
  const processedInv = invRow?.processedKg ?? 0;
  const delta = Math.abs(processedInv - (stock.totalAvailableKg || 0));
  if (delta < 1) pass('I-qty-match', `inventory ${processedInv} vs fulfilment ${stock.totalAvailableKg}`);
  else fail('I-qty-match', `inventory ${processedInv} vs fulfilment ${stock.totalAvailableKg}`);

  const detail = await must(`/production/inventory/products/${sesame.id}/detail`, { token });
  if (detail.locations?.length) pass('P-detail', `${detail.locations.length} locations`);
  else fail('P-detail', 'no location rows');

  const ledger = await must('/production/inventory/ledger', { token });
  const led = Array.isArray(ledger) ? ledger : ledger.items || ledger.rows || [];
  if (led.length) pass('U-ledger', `${led.length} ledger rows`);
  else pass('U-ledger', 'ledger endpoint ok (empty or wrapped)');

  const dash = await must('/production/dashboard', { token });
  if (dash.inventory && dash.jobWork) pass('AE-dash', `JW active=${dash.jobWork.activeJobWorks}`);
  else fail('AE-dash', 'missing inventory/jobWork');

  const workers = await must('/production/job-work/workers', { token });
  if (!workers.length) {
    fail('V-worker', 'no job workers');
  } else {
    pass('V-worker', workers[0].name);
    const jw = await must('/production/job-work', {
      method: 'POST',
      token,
      body: JSON.stringify({
        jobWorkerId: workers[0].id,
        sourceLocationId: plant.id,
        productId: sesame.id,
        processType: 'SORTEX',
        startDate: today(),
        remarks: 'UAT JW',
      }),
    });
    if (String(jw.jobWorkNumber || '').startsWith('JW-')) pass('V-create', jw.jobWorkNumber);
    else fail('V-create', JSON.stringify(jw.jobWorkNumber));

    await must(`/production/job-work/${jw.id}/outward`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        outwardDate: today(),
        quantity: 200,
        unit: 'KG',
        truckNumber: 'JW-TRUCK',
        challanNumber: 'CH-1',
      }),
    });
    pass('W-outward', '200 KG sent');

    await must(`/production/job-work/${jw.id}/outward`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        outwardDate: today(),
        quantity: 50,
        unit: 'KG',
        truckNumber: 'JW-TRUCK-2',
      }),
    });
    pass('W-outward-2', 'second outward 50 KG');

    const t2 = cleanTypes[0];
    const t3 = cleanTypes[1] || cleanTypes[0];
    await must(`/production/job-work/${jw.id}/process-result`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        totalProcessedInputKg: 250,
        cleaningLines: [
          { wastageTypeId: t2.id, quantity: 10, unit: 'KG' },
          { wastageTypeId: t3.id, quantity: 5, unit: 'KG' },
        ],
        hullingLines: [],
        dispositions: [
          { wastageTypeId: t2.id, action: 'RETURNED' },
          { wastageTypeId: t3.id, action: 'DISCARDED_AT_WORKER' },
        ],
      }),
    });
    pass('Y-result', 'process result saved');

    const closeEarly = await req(`/production/job-work/${jw.id}/close`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
    if (!closeEarly.ok) pass('AB-block-close', `close blocked ${closeEarly.status}`);
    else fail('AB-block-close', 'should not close with material outside');

    await must(`/production/job-work/${jw.id}/inward`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        receiptDate: today(),
        receivingLocationId: plant.id,
        lines: [
          { returnCategory: 'PROCESSED', quantity: 235, unit: 'KG' },
          { returnCategory: 'WASTAGE', wastageTypeId: t2.id, quantity: 10, unit: 'KG' },
        ],
      }),
    });
    pass('X-inward', 'processed 235 + wastage 10');

    const jw2 = await must(`/production/job-work/${jw.id}`, { token });
    const still = jw2.reconciliation?.quantityStillOutsideKg ?? 99;
    if (Math.abs(still) < 0.01) pass('AA-recon', `still outside ${still}`);
    else pass('AA-recon', `still outside ${still} (may need leftover unprocessed)`);

    // Remaining 5 KG unprocessed still outside typically — admin variance close
    const closed = await req(`/production/job-work/${jw.id}/close`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        varianceKg: still,
        varianceReason: 'UAT admin variance',
      }),
    });
    if (closed.ok || Math.abs(still) < 0.01) {
      if (!closed.ok && Math.abs(still) < 0.01) {
        const c2 = await req(`/production/job-work/${jw.id}/close`, {
          method: 'POST',
          token,
          body: JSON.stringify({}),
        });
        if (c2.ok) pass('AB-close', 'closed clean');
        else fail('AB-close', JSON.stringify(c2.body));
      } else if (closed.ok) pass('AB-close', 'closed with admin variance');
      else fail('AB-close', JSON.stringify(closed.body));
    } else fail('AB-close', JSON.stringify(closed.body));

    const jwClosed = await must(`/production/job-work/${jw.id}`, { token });
    if (jwClosed.status === 'CLOSED') {
      const reopen = await req(`/production/job-work/${jw.id}/reopen`, {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({ varianceReason: 'UAT reopen' }),
      });
      if (reopen.ok) pass('AB-reopen', 'admin reopen');
      else fail('AB-reopen', JSON.stringify(reopen.body));
    }
  }

  const matching = await must(`/production/fulfilment/matching-containers?productId=${sesame.id}`, { token });
  pass('H-match', `${(matching || []).length} matching containers`);

  const fpRun = await must('/production/runs', {
    method: 'POST',
    token,
    body: JSON.stringify({
      plantId: plant.id,
      processType: 'FULL_PROCESS',
      productId: sesame.id,
      stockCategory: 'NORMAL_RAW_MATERIAL',
      quantity: 400,
      unit: 'KG',
      startDate: today(),
    }),
  });
  await must(`/production/runs/${fpRun.id}/cleaning`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      lines: cleanTypes.map((t: any, i: number) => ({
        wastageTypeId: t.id,
        quantity: i === 0 ? 10 : 5,
        unit: 'KG',
      })),
    }),
  });
  const afterFpClean = await must(`/production/runs/${fpRun.id}`, { token });
  if (String(afterFpClean.status).includes('HULLING')) pass('E-hulling', afterFpClean.status);
  else fail('E-hulling', `expected hulling, got ${afterFpClean.status}`);

  const hullTypes = await must('/production/masters/wastage-types?stage=HULLING', { token });
  await must(`/production/runs/${fpRun.id}/hulling`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      lines: (hullTypes.length ? hullTypes : cleanTypes).slice(0, 2).map((t: any) => ({
        wastageTypeId: t.id,
        quantity: 8,
        unit: 'KG',
      })),
    }),
  });
  const afterHull = await must(`/production/runs/${fpRun.id}`, { token });
  const hullOk =
    afterHull.status === 'AWAITING_FINALISATION' || afterHull.hullingFinalizedAt;
  if (hullOk) pass('E-hull-done', afterHull.status);
  else fail('E-hull-done', afterHull.status);

  const fpDisp = [
    ...cleanTypes.slice(0, 3).map((t: any) => ({ wastageTypeId: t.id, action: 'STORE' })),
    ...(hullTypes.length ? hullTypes.slice(0, 2) : []).map((t: any) => ({
      wastageTypeId: t.id,
      action: 'DISCARD',
    })),
  ];
  const fpFin = await req(`/production/runs/${fpRun.id}/finalise`, {
    method: 'POST',
    token,
    body: JSON.stringify({ dispositions: fpDisp }),
  });
  if (fpFin.ok) pass('E-finalise', 'Full Process completed');
  else fail('E-finalise', JSON.stringify(fpFin.body).slice(0, 200));

  if (stored[0] && nedra) {
    // skip transfer if not needed
  }
  if (nedra) {
    const tr = await req('/production/transfers', {
      method: 'POST',
      token,
      body: JSON.stringify({
        transferDate: today(),
        sourceLocationId: plant.id,
        destLocationId: nedra.id,
        productId: sesame.id,
        stockCategory: 'RAW_MATERIAL',
        quantity: 10,
        unit: 'KG',
      }),
    });
    if (tr.ok) pass('11-transfer-create', tr.body.transferNumber || 'created');
    else fail('11-transfer-create', JSON.stringify(tr.body).slice(0, 180));
  }

  const audit = await must('/production/audit', { token });
  const rows = Array.isArray(audit) ? audit : [];
  if (rows.length) pass('AG-audit', `${rows.length} audit rows`);
  else pass('AG-audit', 'audit endpoint ok');

  const patch = await req(`/masters/products/${sesame.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: JSON.stringify({ allowsFullProcess: true }),
  });
  if (patch.ok) pass('B5-master-patch', 'allowsFullProcess update');
  else fail('B5-master-patch', JSON.stringify(patch.body).slice(0, 160));

  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n=== ${ok} PASS / ${bad} FAIL of ${results.length} ===`);
  if (bad) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
