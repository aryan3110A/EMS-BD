import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockCategory } from '../../common/constants/production.constants';

@Injectable()
export class InventoryLedgerService {
  constructor(private prisma: PrismaService) {}

  private async nextTxnNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LED-${year}-`;
    const latest = await tx.inventoryLedgerEntry.findFirst({
      where: { txnNumber: { startsWith: prefix } },
      orderBy: { txnNumber: 'desc' },
    });
    let next = 1;
    if (latest) {
      const n = parseInt(latest.txnNumber.split('-').pop() || '0', 10);
      if (!isNaN(n)) next = n + 1;
    }
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private async adjustBalance(
    tx: Prisma.TransactionClient,
    productId: string,
    locationId: string,
    stockCategory: string,
    deltaKg: number,
  ): Promise<number> {
    const existing = await tx.inventoryBalance.findUnique({
      where: {
        productId_locationId_stockCategory: { productId, locationId, stockCategory },
      },
    });
    const current = existing?.quantityKg ?? 0;
    const next = Math.round((current + deltaKg) * 1000) / 1000;
    if (next < -0.0001) {
      throw new BadRequestException(
        `Insufficient stock for ${stockCategory} (available ${current} kg, requested ${Math.abs(deltaKg)} kg).`,
      );
    }
    const row = await tx.inventoryBalance.upsert({
      where: {
        productId_locationId_stockCategory: { productId, locationId, stockCategory },
      },
      create: {
        productId,
        locationId,
        stockCategory,
        quantityKg: Math.max(0, next),
      },
      update: { quantityKg: Math.max(0, next) },
    });
    return row.quantityKg;
  }

  async postTxn(
    tx: Prisma.TransactionClient,
    params: {
      txnType: string;
      productId: string;
      stockCategory: string;
      sourceLocationId?: string | null;
      destLocationId?: string | null;
      quantityInKg?: number;
      quantityOutKg?: number;
      referenceType?: string;
      referenceId?: string;
      remarks?: string;
      createdById?: string;
      /** When moving between categories at same plant */
      fromCategory?: string;
      toCategory?: string;
      locationId?: string;
    },
  ) {
    const qtyIn = params.quantityInKg ?? 0;
    const qtyOut = params.quantityOutKg ?? 0;
    let balanceKg: number | null = null;

    if (params.fromCategory && params.toCategory && params.locationId) {
      await this.adjustBalance(tx, params.productId, params.locationId, params.fromCategory, -qtyOut);
      balanceKg = await this.adjustBalance(
        tx,
        params.productId,
        params.locationId,
        params.toCategory,
        qtyIn || qtyOut,
      );
    } else {
      if (qtyOut > 0 && params.sourceLocationId) {
        await this.adjustBalance(
          tx,
          params.productId,
          params.sourceLocationId,
          params.stockCategory,
          -qtyOut,
        );
      }
      if (qtyIn > 0 && params.destLocationId) {
        balanceKg = await this.adjustBalance(
          tx,
          params.productId,
          params.destLocationId,
          params.stockCategory,
          qtyIn,
        );
      }
    }

    const txnNumber = await this.nextTxnNumber(tx);
    return tx.inventoryLedgerEntry.create({
      data: {
        txnNumber,
        txnType: params.txnType,
        productId: params.productId,
        stockCategory: params.toCategory || params.stockCategory,
        sourceLocationId: params.sourceLocationId || params.locationId || null,
        destLocationId: params.destLocationId || params.locationId || null,
        quantityInKg: qtyIn || (params.fromCategory ? qtyOut : 0),
        quantityOutKg: qtyOut,
        balanceKg,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        remarks: params.remarks,
        createdById: params.createdById,
      },
    });
  }

  async getAvailableKg(
    productId: string,
    locationId: string,
    stockCategory: string = StockCategory.RAW_MATERIAL,
  ): Promise<number> {
    const row = await this.prisma.inventoryBalance.findUnique({
      where: {
        productId_locationId_stockCategory: { productId, locationId, stockCategory },
      },
    });
    return row?.quantityKg ?? 0;
  }
}
