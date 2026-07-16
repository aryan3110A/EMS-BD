import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../constants/enums';

@Injectable()
export class NotificationService {
  public readonly emitter = new EventEmitter();

  constructor(private prisma: PrismaService) {}

  async notifyChange(params: {
    type: string;
    message: string;
    contractId?: string;
    containerId?: string;
    oldValue?: string;
    newValue?: string;
    changedById?: string;
    targetRoles?: string[];
    userIds?: string[];
  }) {
    const roles = params.targetRoles ?? [UserRole.SUPER_ADMIN, UserRole.ACCOUNTS_TEAM];
    const rows = [
      ...roles.map((role) => ({
        targetRole: role,
        userId: null as string | null,
        contractId: params.contractId ?? null,
        containerId: params.containerId ?? null,
        type: params.type,
        message: params.message,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        changedById: params.changedById ?? null,
      })),
      ...(params.userIds ?? []).map((userId) => ({
        targetRole: null as string | null,
        userId,
        contractId: params.contractId ?? null,
        containerId: params.containerId ?? null,
        type: params.type,
        message: params.message,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        changedById: params.changedById ?? null,
      })),
    ];

    if (!rows.length) return;

    await this.prisma.notification.createMany({ data: rows });

    const created = await this.prisma.notification.findMany({
      where: {
        contractId: params.contractId ?? undefined,
        type: params.type,
        message: params.message,
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: rows.length,
    });

    for (const notification of created) {
      this.emitter.emit('notification', notification);
    }
  }

  async notifyCommercialAmendment(params: {
    contractId: string;
    containerId: string;
    contractNumber: string;
    containerIndex: number;
    incoterm: string;
    previousValue: number;
    amendedValue: number;
    currency: string;
    reason: string;
    amendedByName: string;
    amendedById?: string;
  }) {
    const label = params.incoterm === 'CNF' ? 'CNF' : 'CIF';
    const message =
      `${label} price changed for Contract ${params.contractNumber}, Container ${params.containerIndex}. ` +
      `Old Price: ${params.currency} ${params.previousValue}. New Price: ${params.currency} ${params.amendedValue}. ` +
      `Changed By: ${params.amendedByName}. Reason: ${params.reason}.`;

    await this.notifyChange({
      type: 'COMMERCIAL_AMENDMENT',
      message,
      contractId: params.contractId,
      containerId: params.containerId,
      oldValue: String(params.previousValue),
      newValue: String(params.amendedValue),
      changedById: params.amendedById,
      targetRoles: [UserRole.SUPER_ADMIN, UserRole.ACCOUNTS_TEAM, UserRole.SUPER_SALES, UserRole.OFFICE_ADMIN],
    });
  }

  findForUser(userId: string, role: string) {
    return this.prisma.notification.findMany({
      where: {
        OR: [{ userId }, { targetRole: role }],
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
