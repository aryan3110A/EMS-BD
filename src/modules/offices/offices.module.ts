import { Module, Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsOptional, IsString } from 'class-validator';

class CreateOfficeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  code?: string;
}

function officeCode(name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);
  return `${base || 'OFF'}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

@Controller('offices')
export class OfficesController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  findAll() {
    return this.prisma.office.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateOfficeDto) {
    return this.prisma.office.create({
      data: {
        code: dto.code?.trim().toUpperCase() || officeCode(dto.name),
        name: dto.name.trim(),
        city: dto.city?.trim() || dto.name.trim(),
      },
    });
  }
}

@Module({
  controllers: [OfficesController],
})
export class OfficesModule {}
