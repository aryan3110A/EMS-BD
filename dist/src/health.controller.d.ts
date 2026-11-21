import { PrismaService } from './prisma/prisma.service';
export declare class HealthController {
    private prisma;
    constructor(prisma: PrismaService);
    check(): Promise<{
        status: string;
        database: string;
        uptimeSeconds: number;
    }>;
}
