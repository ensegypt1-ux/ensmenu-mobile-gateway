import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private ready = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (admin.apps.length > 0) {
      this.ready = true;
      return;
    }

    const inlineJson = this.configService
      .get<string>('firebaseServiceAccountJson')
      ?.trim();
    const filePath = this.configService
      .get<string>('firebaseServiceAccountPath')
      ?.trim();

    try {
      let credentials: admin.ServiceAccount | undefined;

      if (inlineJson) {
        credentials = JSON.parse(inlineJson) as admin.ServiceAccount;
      } else if (filePath) {
        const raw = await readFile(filePath, 'utf8');
        credentials = JSON.parse(raw) as admin.ServiceAccount;
      }

      if (!credentials) {
        this.logger.warn(
          'Firebase Admin is not configured — push sending disabled until FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON is set',
        );
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });
      this.ready = true;
      this.logger.log('Firebase Admin initialized');
    } catch (error) {
      this.logger.error(`Firebase Admin init failed: ${String(error)}`);
    }
  }

  assertReady(): void {
    if (!this.ready) {
      throw new ServiceUnavailableException({
        error: 'Push notifications are not configured',
        errorAr: 'إشعارات الدفع غير مهيأة',
        code: 'FCM_NOT_CONFIGURED',
      });
    }
  }

  async sendMulticast(params: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ successCount: number; failureCount: number }> {
    this.assertReady();

    if (params.tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: params.tokens,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: params.data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'ensmenu_owner_default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  }
}
