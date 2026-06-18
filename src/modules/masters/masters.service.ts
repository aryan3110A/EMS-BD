import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBuyerDto,
  CreatePackagingSizeDto,
  CreatePackagingTypeDto,
  CreateProductDto,
  CreateProductVariantDto,
  CreateSalespersonDto,
} from './masters.dto';

function slugCode(prefix: string, name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${base || 'NEW'}-${suffix}`;
}

@Injectable()
export class MastersService {
  constructor(private prisma: PrismaService) {}

  getSalespersons() {
    return this.prisma.salesperson.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  getBuyers(officeId?: string) {
    return this.prisma.buyer.findMany({
      where: {
        isActive: true,
        ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {}),
      },
      include: { country: true, defaultPort: true },
      orderBy: { name: 'asc' },
    });
  }

  getCountries() {
    return this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCountry(dto: { name: string; code?: string; euClassification?: string }) {
    const code =
      dto.code?.trim().toUpperCase() ||
      `${dto.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) || 'CN'}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    return this.prisma.country.create({
      data: {
        name: dto.name.trim(),
        code,
        region: dto.name.trim(),
        euClassification: dto.euClassification || 'NON_EU',
      },
    });
  }

  getProducts() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: { variants: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  getPackaging() {
    return this.prisma.packagingType.findMany({
      where: { isActive: true },
      include: { sizes: { where: { isActive: true }, orderBy: { weightKg: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  getPorts() {
    return this.prisma.port.findMany({
      where: { isActive: true },
      include: { country: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateBuyer(id: string, dto: {
    address?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    euClassification?: string;
    code?: string;
    countryId?: string;
  }) {
    const existing = await this.prisma.buyer.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      throw new NotFoundException('Buyer not found');
    }

    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
      if (!country) throw new NotFoundException('Country not found');
    }

    const data: Parameters<typeof this.prisma.buyer.update>[0]['data'] = {
      address: dto.address?.trim() || null,
      contactPerson: dto.contactPerson?.trim() || null,
      email: dto.email?.trim() || null,
      phone: dto.phone?.trim() || null,
      ...(dto.euClassification !== undefined ? { euClassification: dto.euClassification } : {}),
      ...(dto.countryId !== undefined ? { countryId: dto.countryId } : {}),
    };

    const requestedCode = dto.code?.trim();
    if (requestedCode && requestedCode.toUpperCase() !== existing.code.toUpperCase()) {
      const taken = await this.prisma.buyer.findFirst({
        where: {
          code: { equals: requestedCode.toUpperCase(), mode: 'insensitive' },
          id: { not: id },
        },
        select: { name: true, code: true },
      });
      if (taken) {
        throw new ConflictException(
          `Buyer code "${requestedCode.toUpperCase()}" is already used by "${taken.name}" (${taken.code})`,
        );
      }
      data.code = requestedCode.toUpperCase();
    }

    return this.prisma.buyer.update({
      where: { id },
      data,
      include: { country: true, defaultPort: true },
    });
  }

  async createSalesperson(dto: CreateSalespersonDto) {
    const code = slugCode('SP', dto.name);
    return this.prisma.salesperson.create({
      data: {
        code,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
      },
    });
  }

  async createBuyer(dto: CreateBuyerDto) {
    const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
    if (!country) throw new NotFoundException('Country not found');

    const code = dto.code?.trim() || slugCode('BUY', dto.name);
    return this.prisma.buyer.create({
      data: {
        code,
        name: dto.name.trim(),
        countryId: dto.countryId,
        officeId: dto.officeId || null,
        euClassification: country.euClassification,
      },
      include: { country: true, defaultPort: true },
    });
  }

  async createProduct(dto: CreateProductDto) {
    const code =
      dto.code?.trim().toUpperCase() ||
      dto.name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 8) ||
      slugCode('PRD', dto.name);

    const product = await this.prisma.product.create({
      data: {
        code,
        name: dto.name.trim(),
        category: dto.category || 'Seeds & Spices',
        defaultSpecification: dto.defaultSpecification || null,
      },
    });

    await this.prisma.productVariant.create({
      data: {
        productId: product.id,
        code: 'NORMAL',
        name: 'Normal',
        processingType: 'Normal',
      },
    });

    return this.prisma.product.findUnique({
      where: { id: product.id },
      include: { variants: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
  }

  async createProductVariant(dto: CreateProductVariantDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || !product.isActive) throw new NotFoundException('Product not found');

    const code = dto.code?.trim().toUpperCase() || dto.name.toUpperCase().replace(/\s+/g, '_').slice(0, 20);
    await this.prisma.productVariant.create({
      data: {
        productId: dto.productId,
        code,
        name: dto.name.trim(),
        processingType: dto.processingType?.trim() || dto.name.trim(),
      },
    });

    return this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { variants: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
  }

  async createPackagingType(dto: CreatePackagingTypeDto) {
    const code = dto.code?.trim().toUpperCase() || slugCode('PKG', dto.name);
    return this.prisma.packagingType.create({
      data: {
        code,
        name: dto.name.trim(),
        material: dto.material?.trim() || dto.name.trim(),
      },
      include: { sizes: { where: { isActive: true } } },
    });
  }

  async createPackagingSize(dto: CreatePackagingSizeDto) {
    const packagingType = await this.prisma.packagingType.findUnique({ where: { id: dto.packagingTypeId } });
    if (!packagingType) throw new NotFoundException('Packaging type not found');

    const unit = (dto.weightUnit || 'KG').toUpperCase();
    const label = dto.label?.trim() || `${packagingType.name.toUpperCase()} OF ${dto.weightValue} ${unit} NET`;

    return this.prisma.packagingSize.create({
      data: {
        packagingTypeId: dto.packagingTypeId,
        label,
        weightKg: unit === 'G' ? dto.weightValue / 1000 : dto.weightValue,
        weightUnit: unit,
      },
    });
  }
}
