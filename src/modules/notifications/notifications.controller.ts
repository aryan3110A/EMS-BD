import { Controller, Get, Patch, Param, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Observable, fromEvent } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotificationService } from '../../common/services/notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.notifications.findForUser(user.sub, user.role);
  }

  @Sse('sse')
  sse(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
    return fromEvent(this.notifications.emitter, 'notification').pipe(
      filter((n: any) => {
        // Stream notification only if it matches the current user's ID or target role
        return n.userId === user.sub || n.targetRole === user.role;
      }),
      map((n: any) => ({
        data: n,
      })),
    );
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }
}
