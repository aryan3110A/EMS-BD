import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { ProductionService } from './production.service';
import { JobWorkService } from './job-work.service';
import {
  AddInputDto,
  AllocateFromStockDto,
  CleaningResultDto,
  CloseJobWorkDto,
  CreateInwardDto,
  CreateJobWorkDto,
  CreateJobWorkerDto,
  CreateSupplierDto,
  CreateTransferDto,
  FinaliseProductionDto,
  FulfilmentAllocateDto,
  HullingResultDto,
  InwardQueryDto,
  JobWorkInwardDto,
  JobWorkOutwardDto,
  JobWorkProcessResultDto,
  SampleResultDto,
  StartProductionDto,
  StartReSortexDto,
} from './production.dto';

const PROD_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.OFFICE_ADMIN,
  UserRole.PRODUCTION_TEAM,
  UserRole.INVENTORY_TEAM,
] as const;

const PRODUCTION_OPS = [
  UserRole.SUPER_ADMIN,
  UserRole.OFFICE_ADMIN,
  UserRole.PRODUCTION_TEAM,
] as const;

const INVENTORY_OPS = [
  UserRole.SUPER_ADMIN,
  UserRole.OFFICE_ADMIN,
  UserRole.PRODUCTION_TEAM,
  UserRole.INVENTORY_TEAM,
] as const;

const READ_ROLES = [
  ...PROD_ROLES,
  UserRole.CONTRACT_TEAM,
  UserRole.SUPER_SALES,
  UserRole.ACCOUNTS_TEAM,
] as const;

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production')
export class ProductionController {
  constructor(
    private production: ProductionService,
    private jobWork: JobWorkService,
  ) {}

  @Roles(...READ_ROLES)
  @Get('masters/locations')
  locations() {
    return this.production.listLocations();
  }

  @Roles(...READ_ROLES)
  @Get('settings')
  settings() {
    return this.production.getSettings();
  }

  @Roles(...READ_ROLES)
  @Get('masters/suppliers')
  suppliers() {
    return this.production.listSuppliers();
  }

  @Roles(...INVENTORY_OPS)
  @Post('masters/suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.production.createSupplier(dto);
  }

  @Roles(...READ_ROLES)
  @Get('masters/inward-types')
  inwardTypes() {
    return this.production.listInwardTypes();
  }

  @Roles(...READ_ROLES)
  @Get('masters/wastage-types')
  wastageTypes(@Query('stage') stage?: string) {
    return this.production.listWastageTypes(stage);
  }

  @Roles(...INVENTORY_OPS)
  @Post('inwards')
  createInward(@Body() dto: CreateInwardDto, @CurrentUser() user: JwtPayload) {
    return this.production.createInward(dto, user);
  }

  @Roles(...READ_ROLES)
  @Get('inwards')
  listInwards(@Query() query: InwardQueryDto) {
    return this.production.listInwards(query);
  }

  @Roles(...READ_ROLES)
  @Get('inventory/balances')
  balances(
    @Query('locationId') locationId?: string,
    @Query('productId') productId?: string,
    @Query('stockCategory') stockCategory?: string,
  ) {
    return this.production.getBalances({ locationId, productId, stockCategory });
  }

  @Roles(...READ_ROLES)
  @Get('inventory/by-product')
  inventoryByProduct(@Query('locationId') locationId?: string) {
    return this.production.getInventoryByProduct(locationId);
  }

  @Roles(...READ_ROLES)
  @Get('inventory/products/:id/detail')
  inventoryProductDetail(@Param('id') id: string, @Query('locationId') locationId?: string) {
    return this.production.getInventoryProductDetail(id, locationId);
  }

  @Roles(...READ_ROLES)
  @Get('inventory/ledger')
  ledger(@Query('productId') productId?: string) {
    return this.production.getLedger({ productId });
  }

  @Roles(...READ_ROLES)
  @Get('wastage-lots')
  wastageLots(@Query('productId') productId?: string, @Query('locationId') locationId?: string) {
    return this.production.listWastageLots({ productId, locationId });
  }

  @Roles(...PRODUCTION_OPS)
  @Post('wastage-lots/:id/discard')
  discardWastage(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.production.discardWastageLot(id, user, body?.reason);
  }

  @Roles(...READ_ROLES)
  @Get('pending-contracts')
  pendingContracts() {
    return this.production.getPendingContracts();
  }

  @Roles(...READ_ROLES)
  @Get('runs')
  listRuns() {
    return this.production.listRuns();
  }

  @Roles(...PRODUCTION_OPS)
  @Post('runs')
  startRun(@Body() dto: StartProductionDto, @CurrentUser() user: JwtPayload) {
    return this.production.startRun(dto, user);
  }

  @Roles(...READ_ROLES)
  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.production.getRun(id);
  }

  @Roles(...PRODUCTION_OPS)
  @Post('runs/:id/inputs')
  addInput(@Param('id') id: string, @Body() dto: AddInputDto, @CurrentUser() user: JwtPayload) {
    return this.production.addInput(id, dto, user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @Post('runs/:id/reopen-cleaning')
  reopenCleaning(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.production.reopenCleaning(id, user, body?.reason);
  }

  @Roles(...PRODUCTION_OPS)
  @Post('runs/:id/cleaning')
  cleaning(@Param('id') id: string, @Body() dto: CleaningResultDto, @CurrentUser() user: JwtPayload) {
    return this.production.submitCleaning(id, dto, user);
  }

  @Roles(...PRODUCTION_OPS)
  @Post('runs/:id/hulling')
  hulling(@Param('id') id: string, @Body() dto: HullingResultDto, @CurrentUser() user: JwtPayload) {
    return this.production.submitHulling(id, dto, user);
  }

  @Roles(...PRODUCTION_OPS)
  @Post('runs/:id/finalise')
  finalise(
    @Param('id') id: string,
    @Body() dto: FinaliseProductionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.production.finaliseProduction(id, dto, user);
  }

  @Roles(...INVENTORY_OPS)
  @Post('fulfilment/from-stock')
  fromStock(@Body() dto: AllocateFromStockDto, @CurrentUser() user: JwtPayload) {
    return this.production.allocateFromProcessedStock(dto, user);
  }

  @Roles(...READ_ROLES)
  @Get('fulfilment/processed-stock')
  fulfilmentStock(@Query('productId') productId?: string, @Query('locationId') locationId?: string) {
    return this.production.getProcessedStockForFulfilment(productId, locationId);
  }

  @Roles(...READ_ROLES)
  @Get('fulfilment/matching-containers')
  matchingContainers(@Query('productId') productId: string) {
    return this.production.getMatchingContainersForProduct(productId);
  }

  @Roles(...INVENTORY_OPS)
  @Post('fulfilment/allocate')
  fulfilmentAllocate(@Body() dto: FulfilmentAllocateDto, @CurrentUser() user: JwtPayload) {
    return this.production.allocateFulfilmentFifo(dto, user);
  }

  @Roles(...READ_ROLES)
  @Get('processed-lots')
  processedLots() {
    return this.production.listProcessedLots();
  }

  @Roles(...READ_ROLES)
  @Get('sampling')
  samples() {
    return this.production.listSamples();
  }

  @Roles(...PRODUCTION_OPS)
  @Patch('sampling/:id')
  updateSample(@Param('id') id: string, @Body() dto: SampleResultDto, @CurrentUser() user: JwtPayload) {
    return this.production.updateSample(id, dto, user);
  }

  @Roles(...READ_ROLES)
  @Get('rejected-lots')
  rejectedLots() {
    return this.production.listRejectedLots();
  }

  @Roles(...READ_ROLES)
  @Get('transfers')
  transfers() {
    return this.production.listTransfers();
  }

  @Roles(...INVENTORY_OPS)
  @Post('transfers')
  createTransfer(@Body() dto: CreateTransferDto, @CurrentUser() user: JwtPayload) {
    return this.production.createTransfer(dto, user);
  }

  @Roles(...INVENTORY_OPS)
  @Post('transfers/:id/dispatch')
  dispatchTransfer(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.production.dispatchTransfer(id, user);
  }

  @Roles(...INVENTORY_OPS)
  @Post('transfers/:id/receive')
  receiveTransfer(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.production.receiveTransfer(id, user);
  }

  // ── Job Work ─────────────────────────────────────────────
  @Roles(...READ_ROLES)
  @Get('job-work/workers')
  jobWorkers() {
    return this.jobWork.listWorkers();
  }

  @Roles(...INVENTORY_OPS)
  @Post('job-work/workers')
  createJobWorker(@Body() dto: CreateJobWorkerDto) {
    return this.jobWork.createWorker(dto);
  }

  @Roles(...READ_ROLES)
  @Get('job-work')
  listJobWork(
    @Query('status') status?: string,
    @Query('productId') productId?: string,
    @Query('jobWorkerId') jobWorkerId?: string,
  ) {
    return this.jobWork.list({ status, productId, jobWorkerId });
  }

  @Roles(...PRODUCTION_OPS)
  @Post('job-work')
  createJobWork(@Body() dto: CreateJobWorkDto, @CurrentUser() user: JwtPayload) {
    return this.jobWork.create(dto, user);
  }

  @Roles(...READ_ROLES)
  @Get('job-work/:id')
  getJobWork(@Param('id') id: string) {
    return this.jobWork.getOne(id);
  }

  @Roles(...INVENTORY_OPS)
  @Post('job-work/:id/outward')
  jobWorkOutward(
    @Param('id') id: string,
    @Body() dto: JobWorkOutwardDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.jobWork.addOutward(id, dto, user);
  }

  @Roles(...INVENTORY_OPS)
  @Post('job-work/:id/inward')
  jobWorkInward(
    @Param('id') id: string,
    @Body() dto: JobWorkInwardDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.jobWork.addInward(id, dto, user);
  }

  @Roles(...PRODUCTION_OPS)
  @Post('job-work/:id/process-result')
  jobWorkProcessResult(
    @Param('id') id: string,
    @Body() dto: JobWorkProcessResultDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.jobWork.submitProcessResult(id, dto, user);
  }

  @Roles(...PRODUCTION_OPS)
  @Post('job-work/:id/close')
  closeJobWork(
    @Param('id') id: string,
    @Body() dto: CloseJobWorkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.jobWork.close(id, dto, user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @Post('job-work/:id/reopen')
  reopenJobWork(
    @Param('id') id: string,
    @Body() dto: CloseJobWorkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.jobWork.reopen(id, dto, user);
  }

  @Roles(...PRODUCTION_OPS)
  @Post('job-work/:id/re-sortex')
  reSortex(
    @Param('id') id: string,
    @Body() dto: StartReSortexDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.jobWork.startReSortex(id, dto, user);
  }

  @Roles(...READ_ROLES)
  @Get('dashboard')
  async dashboard() {
    const [base, jw] = await Promise.all([
      this.production.getOwnerDashboard(),
      this.jobWork.dashboardStats(),
    ]);
    return { ...base, jobWork: jw };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.PRODUCTION_TEAM)
  @Get('audit')
  audit(@Query('module') module?: string, @Query('recordNumber') recordNumber?: string) {
    return this.production.listAudit({ module, recordNumber });
  }
}
