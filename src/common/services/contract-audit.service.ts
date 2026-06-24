import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditFieldChange = {
  contractId: string;
  contractNumber?: string;
  containerId?: string;
  containerIndex?: number;
  fieldName: string;
  previousValue?: string | null;
  newValue?: string | null;
  changedById: string;
};

@Injectable()
export class ContractAuditService {
  constructor(private prisma: PrismaService) {}

  async logChanges(changes: AuditFieldChange[]) {
    if (!changes.length) return;
    await this.prisma.contractAuditLog.createMany({
      data: changes.map((c) => ({
        contractId: c.contractId,
        contractNumber: c.contractNumber,
        containerId: c.containerId,
        containerIndex: c.containerIndex,
        fieldName: c.fieldName,
        previousValue: c.previousValue ?? null,
        newValue: c.newValue ?? null,
        changedById: c.changedById,
      })),
    });
  }

  async logChange(change: AuditFieldChange) {
    await this.logChanges([change]);
  }

  findByContract(contractId: string) {
    return this.prisma.contractAuditLog.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      include: { changedBy: { select: { id: true, name: true, email: true } } },
    });
  }
}
