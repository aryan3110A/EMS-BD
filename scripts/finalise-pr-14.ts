/**
 * Finalise stuck Full Process run PR-2026-00014 after WIP category fix.
 *   npx ts-node scripts/finalise-pr-14.ts
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
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'production@ems.com', password: 'admin123' }),
  });
  if (!login.ok) throw new Error(`login ${login.status} ${JSON.stringify(login.body)}`);
  const token = login.body.accessToken;

  const runs = await req('/production/runs', { token });
  if (!runs.ok) throw new Error(`runs ${runs.status}`);
  const run = (runs.body || []).find((r: any) => r.productionNumber === 'PR-2026-00014');
  if (!run) {
    console.log('PR-2026-00014 not found');
    process.exit(1);
  }
  console.log(`Found ${run.productionNumber} status=${run.status} id=${run.id}`);

  if (run.status === 'COMPLETED') {
    console.log('Already COMPLETED');
    return;
  }

  const detail = await req(`/production/runs/${run.id}`, { token });
  if (!detail.ok) throw new Error(`detail ${detail.status} ${JSON.stringify(detail.body)}`);
  const d = detail.body;
  const lines = [
    ...(d.cleaning || []).filter((c: any) => c.quantityKg > 0.001).map((c: any) => ({
      wastageTypeId: c.wastageTypeId,
      action: 'STORE',
      stage: 'CLEANING',
      qty: c.quantityKg,
    })),
    ...(d.hulling || []).filter((h: any) => h.quantityKg > 0.001).map((h: any) => ({
      wastageTypeId: h.wastageTypeId,
      action: 'DISCARD',
      stage: 'HULLING',
      qty: h.quantityKg,
    })),
  ];
  const dispositions = lines.map((l) => ({ wastageTypeId: l.wastageTypeId, action: l.action }));
  console.log('Dispositions', JSON.stringify(lines));

  const fin = await req(`/production/runs/${run.id}/finalise`, {
    method: 'POST',
    token,
    body: JSON.stringify({ dispositions }),
  });
  if (!fin.ok) {
    console.error('FINALISE FAIL', fin.status, JSON.stringify(fin.body));
    process.exit(1);
  }
  const after = await req(`/production/runs/${run.id}`, { token });
  console.log(`After status=${after.body.status} net=${after.body.netOutputKg} stored=${after.body.storedProcessedKg}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
