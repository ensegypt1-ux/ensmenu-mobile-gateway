import { Injectable } from '@nestjs/common';
import { NotificationDeviceStore } from '../storage/notification-device.store';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly deviceStore: NotificationDeviceStore,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  registerDevice(params: {
    userId: number;
    role?: string;
    deviceId: string;
    platform: 'android' | 'ios';
    fcmToken: string;
  }) {
    return this.deviceStore.register(params);
  }

  unregisterDevice(params: { userId: number; deviceId: string }) {
    return this.deviceStore.unregister(params);
  }

  async sendToUser(params: {
    userId: number;
    event: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    const tokens = this.deviceStore.getActiveTokensForUser(params.userId);
    const data = {
      event: params.event,
      ...(params.data ?? {}),
    };

    const result = await this.firebaseAdmin.sendMulticast({
      tokens,
      title: params.title,
      body: params.body,
      data,
    });

    return {
      targetedDevices: tokens.length,
      ...result,
    };
  }
}
