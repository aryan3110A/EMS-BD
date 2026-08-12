import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductionAuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    module: string;
    recordType: string;
    recordNumber?: string;
    action: string;
    fieldName?: string;
    oldValue?: string | null;
    newValue?: string | null;
    changedById?: string;
    reason?: string;
    ipAddress?: string;
  }) {
    return this.prisma.productionAuditLog.create({
      data: {
        module: params.module,
        recordType: params.recordType,
        recordNumber: params.recordNumber,
        action: params.action,
        fieldName: params.fieldName,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        changedById: params.changedById,
        reason: params.reason,
        ipAddress: params.ipAddress,
      },
    });
  }

  list(query: { module?: string; recordNumber?: string; take?: number }) {
    return this.prisma.productionAuditLog.findMany({
      where: {
        ...(query.module ? { module: query.module } : {}),
        ...(query.recordNumber ? { recordNumber: query.recordNumber } : {}),
      },
      include: { changedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 100,
    });
  }
}
