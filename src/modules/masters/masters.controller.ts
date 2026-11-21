import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MastersService } from './masters.service';
import {
  UpdateBuyerDto,
  UpdatePortDto,
  CreateSalespersonDto,
  CreateBuyerDto,
  CreateProductDto,
  CreateProductVariantDto,
  CreatePackagingTypeDto,
  CreatePackagingSizeDto,
  CreateCountryDto,
  CreatePortDto,
  UpdateProductDto,
} from './masters.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/enums';

/**
 * Roles allowed to create/modify master data. Mirrors the roles the frontend shows the
 * Masters page and the contract form (where buyers/ports are added inline) to.
 * SUPER_ADMIN is always allowed by RolesGuard. Read endpoints stay open to any
 * authenticated user because production/inventory screens read these lists.
 */
const MASTER_EDITORS = [
  UserRole.OFFICE_ADMIN,
  UserRole.CONTRACT_TEAM,
  UserRole.SUPER_SALES,
] as const;

@ApiTags('Masters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('masters')
export class MastersController {
  constructor(private mastersService: MastersService) {}

  @Get('salespersons')
  getSalespersons() {
    return this.mastersService.getSalespersons();
  }

  @Roles(...MASTER_EDITORS)
  @Post('salespersons')
  createSalesperson(@Body() dto: CreateSalespersonDto) {
    return this.mastersService.createSalesperson(dto);
  }

  @Get('buyers')
  getBuyers(
    @CurrentUser() user: JwtPayload,
    @Query('officeId') officeId?: string,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const canSeeAllBuyers =
      user.role === UserRole.SUPER_ADMIN || user.role === UserRole.CONTRACT_TEAM;
    const inactive = includeInactive === 'true' && canSeeAllBuyers;
    if (canSeeAllBuyers) {
      return this.mastersService.getBuyers(officeId || undefined, search, inactive);
    }
    return this.mastersService.getBuyers(user.officeId, search, false);
  }

  @Roles(...MASTER_EDITORS)
  @Post('buyers')
  createBuyer(@CurrentUser() user: JwtPayload, @Body() dto: CreateBuyerDto) {
    return this.mastersService.createBuyer({
      ...dto,
      officeId: dto.officeId ?? user.officeId,
    }, user?.sub);
  }

  @Get('countries')
  getCountries() {
    return this.mastersService.getCountries();
  }

  @Roles(...MASTER_EDITORS)
  @Post('countries')
  createCountry(@Body() dto: CreateCountryDto) {
    return this.mastersService.createCountry(dto);
  }

  @Get('products')
  getProducts() {
    return this.mastersService.getProducts();
  }

  @Roles(...MASTER_EDITORS)
  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.mastersService.createProduct(dto);
  }

  @Roles(...MASTER_EDITORS)
  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.mastersService.updateProduct(id, dto);
  }

  @Roles(...MASTER_EDITORS)
  @Post('product-variants')
  createProductVariant(@Body() dto: CreateProductVariantDto) {
    return this.mastersService.createProductVariant(dto);
  }

  @Get('packaging')
  getPackaging() {
    return this.mastersService.getPackaging();
  }

  @Roles(...MASTER_EDITORS)
  @Post('packaging')
  createPackagingType(@Body() dto: CreatePackagingTypeDto) {
    return this.mastersService.createPackagingType(dto);
  }

  @Roles(...MASTER_EDITORS)
  @Post('packaging/sizes')
  createPackagingSize(@Body() dto: CreatePackagingSizeDto) {
    return this.mastersService.createPackagingSize(dto);
  }

  @Get('users')
  getUsers(@Query('role') role?: string) {
    return this.mastersService.getUsers(role);
  }

  @Get('ports')
  getPorts(@Query('includeInactive') includeInactive?: string) {
    return this.mastersService.getPorts(includeInactive === 'true');
  }

  @Roles(...MASTER_EDITORS)
  @Post('ports')
  createPort(@CurrentUser() user: JwtPayload, @Body() dto: CreatePortDto) {
    return this.mastersService.createPort(dto, user?.sub);
  }

  @Roles(...MASTER_EDITORS)
  @Patch('buyers/:id')
  updateBuyer(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateBuyerDto) {
    return this.mastersService.updateBuyer(id, dto, user?.sub);
  }

  @Roles(...MASTER_EDITORS)
  @Patch('buyers/:id/deactivate')
  deactivateBuyer(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.mastersService.deactivateBuyer(id, user?.sub);
  }

  @Roles(...MASTER_EDITORS)
  @Patch('ports/:id')
  updatePort(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdatePortDto) {
    return this.mastersService.updatePort(id, dto, user?.sub);
  }
}
