import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContainerWorkflowService } from './container-workflow.service';
import { ContainerWorkflowActionDto, SampleRecordUpdateDto } from './container-workflow.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/enums';

const ALL_ROLES = Object.values(UserRole);

/**
 * Container Status (PDF 22.11.26 §6, §9, §14). Fine-grained permissions per action are
 * enforced in the service (allowedActions), so only valid next steps can ever be applied.
 */
@ApiTags('Container Workflow')
@ApiBearerAuth()
@Controller()
export class ContainerWorkflowController {
  constructor(private workflow: ContainerWorkflowService) {}

  @Roles(...ALL_ROLES)
  @Get('contracts/containers/dashboard')
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.workflow.getDashboard(user);
  }

  @Roles(...ALL_ROLES)
  @Get('contracts/:id/containers/workflow')
  list(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workflow.getContractWorkflow(id, user);
  }

  @Roles(...ALL_ROLES)
  @Post('contracts/:id/containers/:containerId/workflow')
  act(
    @Param('id') id: string,
    @Param('containerId') containerId: string,
    @Body() dto: ContainerWorkflowActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflow.performAction(id, containerId, dto, user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.PRODUCTION_TEAM)
  @Patch('production/sampling/:id/step')
  sampleStep(@Param('id') id: string, @Body() dto: SampleRecordUpdateDto, @CurrentUser() user: JwtPayload) {
    return this.workflow.updateSampleRecord(id, dto, user);
  }
}
