import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    this.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (err: any) {
        if (
          err?.code === 'P1017' ||
          err?.message?.includes('closed the connection') ||
          err?.message?.includes('ConnectionReset') ||
          err?.message?.includes('Connection closed')
        ) {
          this.logger.warn(`Database connection dropped (${err.code || 'ConnectionReset'}). Reconnecting...`);
          await this.$connect().catch(() => {});
          return await next(params);
        }
        throw err;
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/** Ensures IDE/tsc always treat PrismaService as the full generated client. */
export interface PrismaService extends PrismaClient {}
