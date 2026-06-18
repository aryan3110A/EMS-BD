import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MastersService } from './masters.service';
import {
  UpdateBuyerDto,
  CreateSalespersonDto,
  CreateBuyerDto,
  CreateProductDto,
  CreateProductVariantDto,
  CreatePackagingTypeDto,
  CreatePackagingSizeDto,
  CreateCountryDto,
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
  getBuyers(@CurrentUser() user: JwtPayload, @Query('officeId') officeId?: string) {
    const canSeeAllBuyers =
      user.role === UserRole.SUPER_ADMIN || user.role === UserRole.CONTRACT_TEAM;
    if (canSeeAllBuyers) {
      // Contract team / admin: all active buyers (optional ?officeId= to narrow)
      return this.mastersService.getBuyers(officeId || undefined);
    }
    return this.mastersService.getBuyers(user.officeId);
  }

  @Post('buyers')
  createBuyer(@CurrentUser() user: JwtPayload, @Body() dto: CreateBuyerDto) {
    return this.mastersService.createBuyer({
      ...dto,
      officeId: dto.officeId ?? user.officeId,
    });
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
  getPorts() {
    return this.mastersService.getPorts();
  }

  @Patch('buyers/:id')
  updateBuyer(@Param('id') id: string, @Body() dto: UpdateBuyerDto) {
    return this.mastersService.updateBuyer(id, dto);
  }
}
