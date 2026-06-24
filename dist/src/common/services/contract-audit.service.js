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
exports.ContractAuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ContractAuditService = class ContractAuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async logChanges(changes) {
        if (!changes.length)
            return;
        await this.prisma.contractAuditLog.createMany({
            data: changes.map((c) => ({
                contractId: c.contractId,
                contractNumber: c.contractNumber,
                containerId: c.containerId,
                containerIndex: c.containerIndex,
                fieldName: c.fieldName,
                previousValue: c.previousValue ?? null,
                newValue: c.newValue ?? null,
                changedById: c.changedById,
            })),
        });
    }
    async logChange(change) {
        await this.logChanges([change]);
    }
    findByContract(contractId) {
        return this.prisma.contractAuditLog.findMany({
            where: { contractId },
            orderBy: { createdAt: 'desc' },
            include: { changedBy: { select: { id: true, name: true, email: true } } },
        });
    }
};
exports.ContractAuditService = ContractAuditService;
exports.ContractAuditService = ContractAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ContractAuditService);
//# sourceMappingURL=contract-audit.service.js.map