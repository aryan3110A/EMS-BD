import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MastersService } from './masters.service';
import { UpdateBuyerDto } from './masters.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
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

  @Get('buyers')
  getBuyers(@CurrentUser() user: JwtPayload, @Query('officeId') officeId?: string) {
    const oid = officeId ?? user.officeId;
    return this.mastersService.getBuyers(oid);
  }

  @Get('countries')
  getCountries() {
    return this.mastersService.getCountries();
  }

  @Get('products')
  getProducts() {
    return this.mastersService.getProducts();
  }

  @Get('packaging')
  getPackaging() {
    return this.mastersService.getPackaging();
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
