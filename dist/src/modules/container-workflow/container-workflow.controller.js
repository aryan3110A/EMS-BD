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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerWorkflowController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const container_workflow_service_1 = require("./container-workflow.service");
const container_workflow_dto_1 = require("./container-workflow.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const enums_1 = require("../../common/constants/enums");
const ALL_ROLES = Object.values(enums_1.UserRole);
let ContainerWorkflowController = class ContainerWorkflowController {
    workflow;
    constructor(workflow) {
        this.workflow = workflow;
    }
    dashboard(user) {
        return this.workflow.getDashboard(user);
    }
    list(id, user) {
        return this.workflow.getContractWorkflow(id, user);
    }
    act(id, containerId, dto, user) {
        return this.workflow.performAction(id, containerId, dto, user);
    }
    sampleStep(id, dto, user) {
        return this.workflow.updateSampleRecord(id, dto, user);
    }
};
exports.ContainerWorkflowController = ContainerWorkflowController;
__decorate([
    (0, roles_decorator_1.Roles)(...ALL_ROLES),
    (0, common_1.Get)('contracts/containers/dashboard'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContainerWorkflowController.prototype, "dashboard", null);
__decorate([
    (0, roles_decorator_1.Roles)(...ALL_ROLES),
    (0, common_1.Get)('contracts/:id/containers/workflow'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ContainerWorkflowController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)(...ALL_ROLES),
    (0, common_1.Post)('contracts/:id/containers/:containerId/workflow'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('containerId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, container_workflow_dto_1.ContainerWorkflowActionDto, Object]),
    __metadata("design:returntype", void 0)
], ContainerWorkflowController.prototype, "act", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.PRODUCTION_TEAM),
    (0, common_1.Patch)('production/sampling/:id/step'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, container_workflow_dto_1.SampleRecordUpdateDto, Object]),
    __metadata("design:returntype", void 0)
], ContainerWorkflowController.prototype, "sampleStep", null);
exports.ContainerWorkflowController = ContainerWorkflowController = __decorate([
    (0, swagger_1.ApiTags)('Container Workflow'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [container_workflow_service_1.ContainerWorkflowService])
], ContainerWorkflowController);
//# sourceMappingURL=container-workflow.controller.js.map