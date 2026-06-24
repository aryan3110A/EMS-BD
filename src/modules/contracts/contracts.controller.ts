import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto, ContractQueryDto } from './contracts.dto';
import { AmendContainerCommercialDto } from './container-commercial.dto';
import { SubmitContractDto } from './submit-contract.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ContractStatus, UserRole } from '../../common/constants/enums';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.contractsService.getDashboardStats(user);
  }

  @Get()
  findAll(@Query() query: ContractQueryDto, @CurrentUser() user: JwtPayload) {
    return this.contractsService.findAll(query, user);
  }

  @Get('exchange-rate')
  getExchangeRate(@Query('currency') currency: string) {
    return this.contractsService.fetchExchangeRate(currency || 'USD');
  }

  @Get(':id/audit')
  getAudit(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.contractsService.getContractAudit(id, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.contractsService.findOne(id, user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.CONTRACT_TEAM)
  @Post('submit')
  submit(@Body() dto: SubmitContractDto, @CurrentUser() user: JwtPayload) {
    return this.contractsService.submit(dto, user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.CONTRACT_TEAM)
  @Post()
  create(@Body() dto: CreateContractDto, @CurrentUser() user: JwtPayload) {
    return this.contractsService.create(dto, user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.CONTRACT_TEAM)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contractsService.update(id, dto, user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.CONTRACT_TEAM)
  @Patch(':id/containers/:containerId/amend-commercial')
  amendCommercial(
    @Param('id') id: string,
    @Param('containerId') containerId: string,
    @Body() dto: AmendContainerCommercialDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contractsService.amendContainerCommercial(id, containerId, dto, user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.CONTRACT_TEAM)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: ContractStatus,
    @Body('remarks') remarks: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contractsService.updateStatus(id, status, user, remarks);
  }
}
