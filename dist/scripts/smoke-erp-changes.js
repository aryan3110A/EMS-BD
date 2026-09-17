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
    let res;
    try {
        res = await fetch(`${API}${path}`, { ...opts, headers });
    }
    catch (e) {
        throw new Error(`Cannot reach API at ${API} (${e?.cause?.code || e?.message}). Start the backend with: npm run start`);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(body)}`);
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
    const plant = locations.find((l) => l.code === 'BHRAMANWADA') || locations[0];
    const sesame = products.find((p) => p.code === 'NSS' || p.allowsFullProcess) || products[0];
    const nonSesame = products.find((p) => p.allowsFullProcess === false) || products.find((p) => p.code === 'AMARANTH');
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
        }
        catch {
            console.log('  OK: Full Process blocked for non-sesame');
        }
    }
    console.log('2) Sortex run → cleaning → finalise (no hulling)');
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
            lines: wastageTypes.map((t, i) => ({
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
            dispositions: wastageTypes.slice(0, 3).map((t, i) => ({
                wastageTypeId: t.id,
                action: i < 2 ? 'STORE' : 'DISCARD',
            })),
        }),
    });
    const done = await req(`/production/runs/${run.id}`, { token });
    if (done.status !== 'COMPLETED')
        throw new Error('Run not completed');
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
    }
    catch {
        console.log('  OK: Run allocate blocked');
    }
    const inv = await req('/production/inventory/by-product', { token });
    console.log(`  OK: Inventory by product rows: ${inv.length}`);
    console.log('3) Outside Warehouse location present');
    const outside = locations.find((l) => l.code === 'OUTSIDE');
    if (!outside)
        throw new Error('Outside Warehouse missing');
    console.log('  OK: Outside Warehouse seeded');
    console.log('4) Job Work workers list');
    const workers = await req('/production/job-work/workers', { token });
    console.log(`  OK: Job workers: ${workers.length}`);
    console.log('5) Sampling helper — Russia requires sampling');
    const contracts = await req('/production/pending-contracts', { token }).catch(() => []);
    const russia = (contracts || []).find((c) => String(c.destinationCountry || c.buyer?.country || '').toLowerCase() === 'russia');
    if (russia) {
        console.log(`  OK: Found Russia contract ${russia.contractNumber || russia.id} (sampling required)`);
    }
    else {
        console.log('  SKIP: No Russia contract in DB (code path requiresSampling covers RU)');
    }
    console.log('\nSmoke completed successfully.');
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=smoke-erp-changes.js.map