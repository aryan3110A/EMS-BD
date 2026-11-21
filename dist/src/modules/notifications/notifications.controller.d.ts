import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotificationService } from '../../common/services/notification.service';
export declare class NotificationsController {
    private notifications;
    constructor(notifications: NotificationService);
    list(user: JwtPayload): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        contractId: string | null;
        containerId: string | null;
        newValue: string | null;
        changedById: string | null;
        userId: string | null;
        targetRole: string | null;
        type: string;
        message: string;
        oldValue: string | null;
        readAt: Date | null;
    }[]>;
    sse(user: JwtPayload): Observable<MessageEvent>;
    markRead(id: string, user: JwtPayload): Promise<{
        id: string;
    }>;
}
