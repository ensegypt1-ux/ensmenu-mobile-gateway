import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AppVersionResponse = {
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  storeUrl: string;
  releaseNotes: string[];
};

const DEFAULT_LATEST = '1.0.0';
const DEFAULT_MINIMUM = '1.0.0';
const DEFAULT_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.ensmenu.ens_owner_app';

@Injectable()
export class AppVersionService {
  constructor(private readonly config: ConfigService) {}

  getAndroidVersion(): AppVersionResponse {
    return {
      latestVersion: this.readVersion(
        'appAndroidLatestVersion',
        DEFAULT_LATEST,
      ),
      minimumVersion: this.readVersion(
        'appAndroidMinimumVersion',
        DEFAULT_MINIMUM,
      ),
      forceUpdate: this.readBool('appAndroidForceUpdate', false),
      storeUrl: this.readNonEmpty('appAndroidStoreUrl', DEFAULT_STORE_URL),
      releaseNotes: this.readReleaseNotes(),
    };
  }

  private readVersion(key: string, fallback: string): string {
    const raw = this.config.get<string>(key);
    if (raw == null || raw.trim() === '') return fallback;
    return raw.trim();
  }

  private readNonEmpty(key: string, fallback: string): string {
    const raw = this.config.get<string>(key);
    if (raw == null || raw.trim() === '') return fallback;
    return raw.trim();
  }

  private readBool(key: string, fallback: boolean): boolean {
    const raw = this.config.get<string | boolean>(key);
    if (raw == null || raw === '') return fallback;
    if (typeof raw === 'boolean') return raw;
    const normalized = String(raw).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private readReleaseNotes(): string[] {
    const raw = this.config.get<string>('appAndroidReleaseNotes');
    if (raw == null || raw.trim() === '') return [];

    const trimmed = raw.trim();
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
    } catch {
      // Not JSON — treat as a single note line.
    }

    return [trimmed];
  }
}
