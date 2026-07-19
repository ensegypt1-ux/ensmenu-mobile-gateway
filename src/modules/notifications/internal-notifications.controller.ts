import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { InternalNotificationsThrottle } from '../../common/decorators/throttle.decorators';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationsService } from './services/notifications.service';

@Controller('internal/notifications')
@Public()
@InternalNotificationsThrottle()
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
      data: sanitizeNotificationData(body.data),
    });

    return {
      success: true,
      ...result,
    };
  }
}

const MAX_DATA_KEYS = 20;
const MAX_DATA_KEY_LEN = 64;
const MAX_DATA_VALUE_LEN = 500;

function sanitizeNotificationData(
  data?: Record<string, string>,
): Record<string, string> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    if (count >= MAX_DATA_KEYS) break;
    if (typeof key !== 'string' || typeof value !== 'string') continue;
    const k = key.trim().slice(0, MAX_DATA_KEY_LEN);
    const v = value.trim().slice(0, MAX_DATA_VALUE_LEN);
    if (!k || !v) continue;
    out[k] = v;
    count += 1;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
