import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

/**
 * Generates x-api-key matching ens-menu-main axiosCall.ts:
 * AES.encrypt(JSON.stringify(`${SECRET_KEY}///${unixSeconds}`), SECRET_KEY)
 * Verified against ens-new-menu-back-main apiKey.middleware.ts decrypt flow.
 */
@Injectable()
export class ApiKeyService {
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('secretKey') ?? '';
  }

  isConfigured(): boolean {
    return this.secretKey.length > 0;
  }

  generateHeaderValue(): string {
    if (!this.secretKey) {
      throw new Error('SECRET_KEY is not configured for upstream x-api-key');
    }

    const offsetSec =
      this.configService.get<number>('apiKeyTimeOffsetSeconds') ?? 0;
    const utcTime = parseFloat(
      (Date.now() / 1000 + offsetSec).toFixed(3),
    );
    const payload = `${this.secretKey}///${utcTime}`;
    const jsonString = JSON.stringify(payload);
    return CryptoJS.AES.encrypt(jsonString, this.secretKey).toString();
  }
}
