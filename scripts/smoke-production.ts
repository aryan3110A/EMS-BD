/**
 * Production module API smoke test.
 * Usage (backend running on :3001):
 *   npx ts-node scripts/smoke-production.ts
 */
const BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';

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
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  console.log('Logging in as production@ems.com…');
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'production@ems.com', password: 'admin123' }),
  });
  const token = login.accessToken || login.token;
  if (!token) throw new Error('No token from login');

  const checks: Array<[string, () => Promise<unknown>]> = [
    ['locations', () => req('/production/masters/locations', { token })],
    ['suppliers', () => req('/production/masters/suppliers', { token })],
    ['inward-types', () => req('/production/masters/inward-types', { token })],
    ['wastage-types', () => req('/production/masters/wastage-types', { token })],
    ['inwards', () => req('/production/inwards', { token })],
    ['balances', () => req('/production/inventory/balances', { token })],
    ['ledger', () => req('/production/inventory/ledger', { token })],
    ['pending-contracts', () => req('/production/pending-contracts', { token })],
    ['runs', () => req('/production/runs', { token })],
    ['processed-lots', () => req('/production/processed-lots', { token })],
    ['sampling', () => req('/production/sampling', { token })],
    ['rejected-lots', () => req('/production/rejected-lots', { token })],
    ['transfers', () => req('/production/transfers', { token })],
    ['dashboard', () => req('/production/dashboard', { token })],
    ['audit', () => req('/production/audit', { token })],
  ];

  let failed = 0;
  for (const [name, fn] of checks) {
    try {
      const data = await fn();
      const n = Array.isArray(data) ? data.length : typeof data === 'object' && data ? Object.keys(data).length : 0;
      console.log(`✓ ${name} (${n})`);
    } catch (e: any) {
      failed += 1;
      console.error(`✗ ${name}: ${e.message}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll production smoke checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
