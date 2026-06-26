import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../constants/enums';

@Injectable()
export class NotificationService {
  public readonly emitter = new EventEmitter();

  constructor(private prisma: PrismaService) {}

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
  }) {
    const label = params.incoterm === 'CNF' ? 'CNF' : 'CIF';
    const message = `${label} price for Contract ${params.contractNumber}, Container ${params.containerIndex} was changed from ${params.currency} ${params.previousValue} to ${params.currency} ${params.amendedValue} by ${params.amendedByName}. Reason: ${params.reason}.`;

    const roles = [UserRole.SUPER_ADMIN, UserRole.ACCOUNTS_TEAM];

    await this.prisma.notification.createMany({
      data: roles.map((role) => ({
        targetRole: role,
        contractId: params.contractId,
        containerId: params.containerId,
        type: 'COMMERCIAL_AMENDMENT',
        message,
      })),
    });

    // Fetch the newly created notifications to emit them with database IDs and timestamps
    const created = await this.prisma.notification.findMany({
      where: {
        contractId: params.contractId,
        containerId: params.containerId,
        type: 'COMMERCIAL_AMENDMENT',
        message,
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: roles.length,
    });

    for (const notification of created) {
      this.emitter.emit('notification', notification);
    }
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
