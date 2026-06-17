import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  getProducts() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: { variants: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
  }

  getPackaging() {
    return this.prisma.packagingType.findMany({
      where: { isActive: true },
      include: { sizes: { where: { isActive: true } } },
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
  }) {
    const existing = await this.prisma.buyer.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      throw new NotFoundException('Buyer not found');
    }

    return this.prisma.buyer.update({
      where: { id },
      data: {
        address: dto.address?.trim() || null,
        contactPerson: dto.contactPerson?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        ...(dto.euClassification !== undefined ? { euClassification: dto.euClassification } : {}),
      },
      include: { country: true, defaultPort: true },
    });
  }
}
