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
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    if (opts.token)
        headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(`${opts.method || 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`);
    return body;
}
async function main() {
    const login = await req('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'production@ems.com', password: 'admin123' }),
    });
    const token = login.accessToken;
    const runs = await req('/production/runs', { token });
    const run = (runs || []).find((r) => r.productionNumber === 'PR-2026-00014');
    if (!run)
        throw new Error('PR-2026-00014 not found');
    const detail = await req(`/production/runs/${run.id}`, { token });
    console.log(`status=${detail.status} input=${detail.totalInputKg} net=${detail.netOutputKg}`);
    if (detail.status === 'COMPLETED') {
        console.log('Already COMPLETED');
        return;
    }
    const lines = [
        ...(detail.cleaning || []).filter((c) => c.quantityKg > 0.001).map((c) => ({
            wastageTypeId: c.wastageTypeId,
            action: 'STORE',
        })),
        ...(detail.hulling || []).filter((h) => h.quantityKg > 0.001).map((h) => ({
            wastageTypeId: h.wastageTypeId,
            action: 'DISCARD',
        })),
    ];
    const seen = new Set();
    const dispositions = lines.filter((d) => {
        if (seen.has(d.wastageTypeId))
            return false;
        seen.add(d.wastageTypeId);
        return true;
    });
    console.log(`dispositions=${dispositions.length}`);
    const done = await req(`/production/runs/${run.id}/finalise`, {
        method: 'POST',
        token,
        body: JSON.stringify({ dispositions }),
    });
    console.log(`finalise status=${done.status} storedProcessedKg=${done.storedProcessedKg ?? done.netOutputKg}`);
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=finalise-pr-00014.js.map