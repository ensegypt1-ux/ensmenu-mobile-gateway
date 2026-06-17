import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';

export interface NotificationDeviceRecord {
  userId: number;
  role?: string;
  deviceId: string;
  platform: 'android' | 'ios';
  fcmToken: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DeviceStoreFile {
  devices: NotificationDeviceRecord[];
}

@Injectable()
export class NotificationDeviceStore implements OnModuleInit {
  private readonly logger = new Logger(NotificationDeviceStore.name);
  private readonly storePath: string;
  private devices: NotificationDeviceRecord[] = [];

  constructor(private readonly configService: ConfigService) {
    this.storePath =
      this.configService.get<string>('notificationDevicesStorePath') ??
      './data/notification-devices.json';
  }

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  private deviceKey(userId: number, deviceId: string): string {
    return `${userId}:${deviceId}`;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as DeviceStoreFile;
      this.devices = Array.isArray(parsed.devices) ? parsed.devices : [];
      this.logger.log(`Loaded ${this.devices.length} notification device(s)`);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        await this.persist();
        this.logger.log('Initialized empty notification device store');
        return;
      }
      this.logger.error(`Failed to load device store: ${String(error)}`);
      this.devices = [];
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    const payload: DeviceStoreFile = { devices: this.devices };
    await writeFile(this.storePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  async register(params: {
    userId: number;
    role?: string;
    deviceId: string;
    platform: 'android' | 'ios';
    fcmToken: string;
  }): Promise<NotificationDeviceRecord> {
    const now = new Date().toISOString();
    const key = this.deviceKey(params.userId, params.deviceId);
    const index = this.devices.findIndex(
      (d) => this.deviceKey(d.userId, d.deviceId) === key,
    );

    if (index >= 0) {
      const existing = this.devices[index];
      const updated: NotificationDeviceRecord = {
        ...existing,
        role: params.role ?? existing.role,
        platform: params.platform,
        fcmToken: params.fcmToken,
        isActive: true,
        updatedAt: now,
      };
      this.devices[index] = updated;
      await this.persist();
      return updated;
    }

    const created: NotificationDeviceRecord = {
      userId: params.userId,
      role: params.role,
      deviceId: params.deviceId,
      platform: params.platform,
      fcmToken: params.fcmToken,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.devices.push(created);
    await this.persist();
    return created;
  }

  async unregister(params: {
    userId: number;
    deviceId: string;
  }): Promise<boolean> {
    const key = this.deviceKey(params.userId, params.deviceId);
    const index = this.devices.findIndex(
      (d) => this.deviceKey(d.userId, d.deviceId) === key,
    );
    if (index < 0) return false;

    const now = new Date().toISOString();
    this.devices[index] = {
      ...this.devices[index],
      isActive: false,
      updatedAt: now,
    };
    await this.persist();
    return true;
  }

  getActiveTokensForUser(userId: number): string[] {
    const tokens = new Set<string>();
    for (const device of this.devices) {
      if (device.userId !== userId || !device.isActive) continue;
      if (device.fcmToken.trim()) tokens.add(device.fcmToken.trim());
    }
    return [...tokens];
  }
}
