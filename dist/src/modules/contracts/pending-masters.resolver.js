"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePendingMastersInTx = resolvePendingMastersInTx;
exports.applyPendingIdMap = applyPendingIdMap;
exports.applyPendingIdsToContractDto = applyPendingIdsToContractDto;
exports.updateBuyerInTx = updateBuyerInTx;
exports.resolveId = resolveId;
const common_1 = require("@nestjs/common");
function slugCode(prefix, name) {
    const base = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24);
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    return `${prefix}-${base || 'NEW'}-${suffix}`;
}
function officeCode(name) {
    const base = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 6);
    return `${base || 'OFF'}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
function resolveId(id, idMap) {
    if (!id)
        return undefined;
    return idMap.get(id) ?? id;
}
async function ensureUniqueBuyerCode(tx, code, excludeBuyerId) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
        throw new common_1.ConflictException('Buyer code cannot be empty');
    }
    const taken = await tx.buyer.findFirst({
        where: {
            code: { equals: normalized, mode: 'insensitive' },
            ...(excludeBuyerId ? { id: { not: excludeBuyerId } } : {}),
        },
        select: { id: true, name: true, code: true },
    });
    if (taken) {
        throw new common_1.ConflictException(`Buyer code "${normalized}" is already used by "${taken.name}" (${taken.code})`);
    }
    return normalized;
}
async function resolvePendingMastersInTx(tx, pending, officeId, contractBuyerId, buyerUpdate) {
    const idMap = new Map();
    if (!pending)
        return idMap;
    for (const c of pending.countries ?? []) {
        const code = `${c.name
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6) || 'CN'}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        const created = await tx.country.create({
            data: {
                name: c.name.trim(),
                code,
                region: c.name.trim(),
                euClassification: c.euClassification || 'NON_EU',
            },
        });
        idMap.set(c.id, created.id);
    }
    for (const o of pending.offices ?? []) {
        const created = await tx.office.create({
            data: {
                code: officeCode(o.name),
                name: o.name.trim(),
                city: o.city?.trim() || o.name.trim(),
            },
        });
        idMap.set(o.id, created.id);
    }
    for (const s of pending.salespersons ?? []) {
        const created = await tx.salesperson.create({
            data: {
                code: slugCode('SP', s.name),
                name: s.name.trim(),
            },
        });
        idMap.set(s.id, created.id);
    }
    for (const p of pending.products ?? []) {
        let code = p.code.trim().toUpperCase();
        const codeTaken = await tx.product.findFirst({
            where: { code: { equals: code, mode: 'insensitive' } },
        });
        if (codeTaken)
            code = slugCode('PRD', p.name);
        const created = await tx.product.create({
            data: {
                code,
                name: p.name.trim(),
                category: 'Seeds & Spices',
            },
        });
        idMap.set(p.id, created.id);
        for (const v of p.variants ?? []) {
            const variant = await tx.productVariant.create({
                data: {
                    productId: created.id,
                    code: v.code?.trim().toUpperCase() || v.name.toUpperCase().replace(/\s+/g, '_').slice(0, 20),
                    name: v.name.trim(),
                    processingType: v.processingType?.trim() || v.name.trim(),
                },
            });
            idMap.set(v.id, variant.id);
        }
    }
    for (const pv of pending.productVariants ?? []) {
        const productId = resolveId(pv.productId, idMap);
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product || !product.isActive)
            throw new common_1.NotFoundException('Product not found');
        const variant = await tx.productVariant.create({
            data: {
                productId,
                code: pv.name.toUpperCase().replace(/\s+/g, '_').slice(0, 20),
                name: pv.name.trim(),
                processingType: pv.processingType?.trim() || pv.name.trim(),
            },
        });
        idMap.set(pv.id, variant.id);
    }
    const resolvedOfficeId = resolveId(officeId, idMap) ?? officeId;
    for (const b of pending.buyers ?? []) {
        const existingBuyer = await tx.buyer.findFirst({
            where: { name: { equals: b.name.trim(), mode: 'insensitive' }, isActive: true },
        });
        if (existingBuyer) {
            idMap.set(b.id, existingBuyer.id);
            continue;
        }
        const countryId = resolveId(buyerUpdate?.countryId ?? b.countryId, idMap);
        const country = await tx.country.findUnique({ where: { id: countryId } });
        if (!country)
            throw new common_1.NotFoundException('Country not found');
        const isContractBuyer = contractBuyerId === b.id;
        const update = isContractBuyer ? buyerUpdate : undefined;
        const code = await ensureUniqueBuyerCode(tx, update?.code?.trim() || slugCode('BUY', b.name));
        const created = await tx.buyer.create({
            data: {
                code,
                name: b.name.trim(),
                countryId,
                officeId: resolvedOfficeId,
                euClassification: update?.euClassification ?? country.euClassification,
                address: update?.address?.trim() || null,
                contactPerson: update?.contactPerson?.trim() || null,
                email: update?.email?.trim() || null,
                phone: update?.phone?.trim() || null,
            },
        });
        idMap.set(b.id, created.id);
    }
    for (const pt of pending.packagingTypes ?? []) {
        let code = pt.code?.trim().toUpperCase() || slugCode('PKG', pt.name);
        const codeTaken = await tx.packagingType.findFirst({
            where: { code: { equals: code, mode: 'insensitive' } },
        });
        if (codeTaken)
            code = slugCode('PKG', pt.name);
        const created = await tx.packagingType.create({
            data: {
                code,
                name: pt.name.trim(),
                material: pt.name.trim(),
            },
        });
        idMap.set(pt.id, created.id);
    }
    for (const ps of pending.packagingSizes ?? []) {
        const packagingTypeId = resolveId(ps.packagingTypeId, idMap);
        const packagingType = await tx.packagingType.findUnique({ where: { id: packagingTypeId } });
        if (!packagingType)
            throw new common_1.NotFoundException('Packaging type not found');
        const unit = (ps.weightUnit || 'KG').toUpperCase();
        const label = ps.label?.trim() || `${packagingType.name.toUpperCase()} OF ${ps.weightValue} ${unit} NET`;
        const created = await tx.packagingSize.create({
            data: {
                packagingTypeId,
                label,
                weightKg: unit === 'G' ? ps.weightValue / 1000 : ps.weightValue,
                weightUnit: unit,
            },
        });
        idMap.set(ps.id, created.id);
    }
    return idMap;
}
function applyPendingIdMap(idMap, values, keys) {
    const next = { ...values };
    for (const key of keys) {
        const value = next[key];
        if (typeof value === 'string') {
            next[key] = resolveId(value, idMap);
        }
    }
    return next;
}
function applyPendingIdsToContractDto(dto, idMap) {
    const resolved = applyPendingIdMap(idMap, dto, [
        'officeId',
        'salespersonId',
        'buyerId',
        'productId',
        'productVariantId',
        'packagingTypeId',
        'packagingSizeId',
    ]);
    if (resolved.containerProducts?.length) {
        resolved.containerProducts = resolved.containerProducts.map((c) => ({
            ...c,
            productId: resolveId(c.productId, idMap) ?? c.productId,
            productVariantId: c.productVariantId
                ? resolveId(c.productVariantId, idMap) ?? c.productVariantId
                : c.productVariantId,
        }));
    }
    return resolved;
}
async function updateBuyerInTx(tx, buyerId, dto, idMap) {
    const resolvedBuyerId = resolveId(buyerId, idMap);
    const existing = await tx.buyer.findUnique({ where: { id: resolvedBuyerId } });
    if (!existing || !existing.isActive)
        throw new common_1.NotFoundException('Buyer not found');
    const countryId = dto.countryId ? resolveId(dto.countryId, idMap) : undefined;
    if (countryId) {
        const country = await tx.country.findUnique({ where: { id: countryId } });
        if (!country)
            throw new common_1.NotFoundException('Country not found');
    }
    const data = {
        address: dto.address?.trim() || null,
        contactPerson: dto.contactPerson?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        ...(dto.euClassification !== undefined ? { euClassification: dto.euClassification } : {}),
        ...(countryId !== undefined ? { countryId } : {}),
    };
    const requestedCode = dto.code?.trim();
    if (requestedCode && requestedCode.toUpperCase() !== existing.code.toUpperCase()) {
        data.code = await ensureUniqueBuyerCode(tx, requestedCode, resolvedBuyerId);
    }
    const hasChanges = data.address !== (existing.address ?? null) ||
        data.contactPerson !== (existing.contactPerson ?? null) ||
        data.email !== (existing.email ?? null) ||
        data.phone !== (existing.phone ?? null) ||
        (dto.euClassification !== undefined && dto.euClassification !== existing.euClassification) ||
        (countryId !== undefined && countryId !== existing.countryId) ||
        !!data.code;
    if (!hasChanges)
        return;
    await tx.buyer.update({
        where: { id: resolvedBuyerId },
        data,
    });
}
//# sourceMappingURL=pending-masters.resolver.js.map