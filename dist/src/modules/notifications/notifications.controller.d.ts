import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotificationService } from '../../common/services/notification.service';
export declare class NotificationsController {
    private notifications;
    constructor(notifications: NotificationService);
    list(user: JwtPayload): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        userId: string | null;
        targetRole: string | null;
        contractId: string | null;
        containerId: string | null;
        type: string;
        message: string;
        readAt: Date | null;
        createdAt: Date;
    }[]>;
    sse(user: JwtPayload): Observable<MessageEvent>;
    markRead(id: string): import(".prisma/client").Prisma.Prisma__NotificationClient<{
        id: string;
        userId: string | null;
        targetRole: string | null;
        contractId: string | null;
        containerId: string | null;
        type: string;
        message: string;
        readAt: Date | null;
        createdAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
