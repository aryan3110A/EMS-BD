"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
const prisma_service_1 = require("../../prisma/prisma.service");
const enums_1 = require("../constants/enums");
let NotificationService = class NotificationService {
    prisma;
    emitter = new events_1.EventEmitter();
    constructor(prisma) {
        this.prisma = prisma;
    }
    async notifyChange(params) {
        const roles = params.targetRoles ?? [enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.ACCOUNTS_TEAM];
        const rows = [
            ...roles.map((role) => ({
                targetRole: role,
                userId: null,
                contractId: params.contractId ?? null,
                containerId: params.containerId ?? null,
                type: params.type,
                message: params.message,
                oldValue: params.oldValue ?? null,
                newValue: params.newValue ?? null,
                changedById: params.changedById ?? null,
            })),
            ...(params.userIds ?? []).map((userId) => ({
                targetRole: null,
                userId,
                contractId: params.contractId ?? null,
                containerId: params.containerId ?? null,
                type: params.type,
                message: params.message,
                oldValue: params.oldValue ?? null,
                newValue: params.newValue ?? null,
                changedById: params.changedById ?? null,
            })),
        ];
        if (!rows.length)
            return;
        await this.prisma.notification.createMany({ data: rows });
        const created = await this.prisma.notification.findMany({
            where: {
                contractId: params.contractId ?? undefined,
                type: params.type,
                message: params.message,
                readAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: rows.length,
        });
        for (const notification of created) {
            this.emitter.emit('notification', notification);
        }
    }
    async notifyCommercialAmendment(params) {
        const label = params.incoterm === 'CNF' ? 'CNF' : 'CIF';
        const message = `${label} price changed for Contract ${params.contractNumber}, Container ${params.containerIndex}. ` +
            `Old Price: ${params.currency} ${params.previousValue}. New Price: ${params.currency} ${params.amendedValue}. ` +
            `Changed By: ${params.amendedByName}. Reason: ${params.reason}.`;
        await this.notifyChange({
            type: 'COMMERCIAL_AMENDMENT',
            message,
            contractId: params.contractId,
            containerId: params.containerId,
            oldValue: String(params.previousValue),
            newValue: String(params.amendedValue),
            changedById: params.amendedById,
            targetRoles: [enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.ACCOUNTS_TEAM, enums_1.UserRole.SUPER_SALES, enums_1.UserRole.OFFICE_ADMIN],
        });
    }
    findForUser(userId, role) {
        return this.prisma.notification.findMany({
            where: {
                OR: [{ userId }, { targetRole: role }],
                readAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    markRead(id) {
        return this.prisma.notification.update({
            where: { id },
            data: { readAt: new Date() },
        });
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map