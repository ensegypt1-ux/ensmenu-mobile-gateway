import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { requireAuthIdentity } from '../../common/utils/jwt-payload.util';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UnregisterDeviceDto } from './dto/unregister-device.dto';
import { NotificationsService } from './services/notifications.service';

@Controller(['mobile/v1/notifications/devices', 'owner/notifications/devices'])
@UseGuards(OwnerOnlyGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register')
  async register(@Req() req: Request, @Body() body: RegisterDeviceDto) {
    const user = requireAuthIdentity(req);
    const device = await this.notificationsService.registerDevice({
      userId: user.userId,
      role: user.role,
      deviceId: body.deviceId.trim(),
      platform: body.platform,
      fcmToken: body.fcmToken.trim(),
    });

    return {
      success: true,
      device: {
        deviceId: device.deviceId,
        platform: device.platform,
        isActive: device.isActive,
        updatedAt: device.updatedAt,
      },
    };
  }

  @Post('unregister')
  async unregister(@Req() req: Request, @Body() body: UnregisterDeviceDto) {
    const user = requireAuthIdentity(req);
    const deactivated = await this.notificationsService.unregisterDevice({
      userId: user.userId,
      deviceId: body.deviceId.trim(),
    });

    return { success: true, deactivated };
  }
}
