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
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const API = process.env.API_URL || 'http://127.0.0.1:3001/api/v1';
async function req(path, opts = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...opts.headers,
    };
    if (opts.token)
        headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
}
async function main() {
    const login = await req('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'production@ems.com', password: 'admin123' }),
    });
    if (!login.ok)
        throw new Error(`login ${login.status} ${JSON.stringify(login.body)}`);
    const token = login.body.accessToken;
    const runs = await req('/production/runs', { token });
    if (!runs.ok)
        throw new Error(`runs ${runs.status}`);
    const run = (runs.body || []).find((r) => r.productionNumber === 'PR-2026-00014');
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
    if (!detail.ok)
        throw new Error(`detail ${detail.status} ${JSON.stringify(detail.body)}`);
    const d = detail.body;
    const lines = [
        ...(d.cleaning || []).filter((c) => c.quantityKg > 0.001).map((c) => ({
            wastageTypeId: c.wastageTypeId,
            action: 'STORE',
            stage: 'CLEANING',
            qty: c.quantityKg,
        })),
        ...(d.hulling || []).filter((h) => h.quantityKg > 0.001).map((h) => ({
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
//# sourceMappingURL=finalise-pr-14.js.map