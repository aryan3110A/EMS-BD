import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto, ContractQueryDto } from './contracts.dto';
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

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.contractsService.findOne(id, user);
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
