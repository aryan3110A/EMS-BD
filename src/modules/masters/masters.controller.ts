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
} from './masters.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';

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

  @Post('countries')
  createCountry(@Body() dto: CreateCountryDto) {
    return this.mastersService.createCountry(dto);
  }

  @Get('products')
  getProducts() {
    return this.mastersService.getProducts();
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.mastersService.createProduct(dto);
  }

  @Post('product-variants')
  createProductVariant(@Body() dto: CreateProductVariantDto) {
    return this.mastersService.createProductVariant(dto);
  }

  @Get('packaging')
  getPackaging() {
    return this.mastersService.getPackaging();
  }

  @Post('packaging')
  createPackagingType(@Body() dto: CreatePackagingTypeDto) {
    return this.mastersService.createPackagingType(dto);
  }

  @Post('packaging/sizes')
  createPackagingSize(@Body() dto: CreatePackagingSizeDto) {
    return this.mastersService.createPackagingSize(dto);
  }

  @Get('ports')
  getPorts(@Query('includeInactive') includeInactive?: string) {
    return this.mastersService.getPorts(includeInactive === 'true');
  }

  @Post('ports')
  createPort(@CurrentUser() user: JwtPayload, @Body() dto: CreatePortDto) {
    return this.mastersService.createPort(dto, user?.sub);
  }

  @Patch('buyers/:id')
  updateBuyer(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateBuyerDto) {
    return this.mastersService.updateBuyer(id, dto, user?.sub);
  }

  @Patch('buyers/:id/deactivate')
  deactivateBuyer(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.mastersService.deactivateBuyer(id, user?.sub);
  }

  @Patch('ports/:id')
  updatePort(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdatePortDto) {
    return this.mastersService.updatePort(id, dto, user?.sub);
  }
}
