"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../prisma/prisma.module");
const notification_service_1 = require("../../common/services/notification.service");
const production_controller_1 = require("./production.controller");
const production_service_1 = require("./production.service");
const inventory_ledger_service_1 = require("./inventory-ledger.service");
const production_audit_service_1 = require("./production-audit.service");
let ProductionModule = class ProductionModule {
};
exports.ProductionModule = ProductionModule;
exports.ProductionModule = ProductionModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [production_controller_1.ProductionController],
        providers: [production_service_1.ProductionService, inventory_ledger_service_1.InventoryLedgerService, production_audit_service_1.ProductionAuditService, notification_service_1.NotificationService],
        exports: [production_service_1.ProductionService, inventory_ledger_service_1.InventoryLedgerService],
    })
], ProductionModule);
//# sourceMappingURL=production.module.js.map