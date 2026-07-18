import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SkipRateLimit } from '../../common/decorators/throttle.decorators';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationsService } from './services/notifications.service';

@Controller('internal/notifications')
@Public()
@SkipRateLimit()
@UseGuards(InternalSecretGuard)
export class InternalNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  async send(@Body() body: SendNotificationDto) {
    const result = await this.notificationsService.sendToUser({
      userId: body.userId,
      event: body.event,
      title: body.title.trim(),
      body: body.body.trim(),
      data: body.data,
    });

    return {
      success: true,
      ...result,
    };
  }
}
