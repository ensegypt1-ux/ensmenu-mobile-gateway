import { Module } from '@nestjs/common';
import { InternalNotificationsController } from './internal-notifications.controller';
import { NotificationsController } from './notifications.controller';
import { FirebaseAdminService } from './services/firebase-admin.service';
import { NotificationsService } from './services/notifications.service';
import { NotificationDeviceStore } from './storage/notification-device.store';

@Module({
  controllers: [NotificationsController, InternalNotificationsController],
  providers: [
    NotificationDeviceStore,
    FirebaseAdminService,
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
