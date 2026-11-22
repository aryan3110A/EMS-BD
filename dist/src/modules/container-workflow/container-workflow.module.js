"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerWorkflowModule = void 0;
const common_1 = require("@nestjs/common");
const container_workflow_service_1 = require("./container-workflow.service");
const container_workflow_controller_1 = require("./container-workflow.controller");
const inventory_ledger_service_1 = require("../production/inventory-ledger.service");
const notification_service_1 = require("../../common/services/notification.service");
let ContainerWorkflowModule = class ContainerWorkflowModule {
};
exports.ContainerWorkflowModule = ContainerWorkflowModule;
exports.ContainerWorkflowModule = ContainerWorkflowModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        controllers: [container_workflow_controller_1.ContainerWorkflowController],
        providers: [container_workflow_service_1.ContainerWorkflowService, inventory_ledger_service_1.InventoryLedgerService, notification_service_1.NotificationService],
        exports: [container_workflow_service_1.ContainerWorkflowService, inventory_ledger_service_1.InventoryLedgerService, notification_service_1.NotificationService],
    })
], ContainerWorkflowModule);
//# sourceMappingURL=container-workflow.module.js.map