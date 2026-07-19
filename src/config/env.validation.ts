import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @IsString()
  @IsNotEmpty()
  NODE_ENV: string = 'development';

  @IsUrl({ require_tld: false })
  ENS_BACKEND_URL: string;

  @IsUrl({ require_tld: false })
  ASSET_PUBLIC_BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string = '*';

  @IsOptional()
  @IsString()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsNotEmpty()
  SECRET_KEY: string;

  @IsOptional()
  @IsInt()
  @Min(-120)
  @Max(120)
  API_KEY_TIME_OFFSET_SECONDS?: number;

  @IsOptional()
  @IsString()
  PUBLIC_MENU_HOST_SUFFIX?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  UPSTREAM_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  IMPORT_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  UPLOAD_MAX_MB?: number;

  @IsOptional()
  @IsString()
  REQUEST_JSON_LIMIT?: string;

  @IsOptional()
  @IsString()
  REQUEST_URLENCODED_LIMIT?: string;

  @IsOptional()
  @IsInt()
  @Min(1024)
  UPSTREAM_MAX_CONTENT_LENGTH_BYTES?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS?: number;

  @IsOptional()
  @IsString()
  PEXELS_API_KEY?: string;

  /** Server-only Google Places / Geocoding web-service key (not Maps SDK). */
  @IsOptional()
  @IsString()
  GOOGLE_MAPS_SERVER_API_KEY?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  MAPS_UPSTREAM_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_MAPS_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_MAPS_LIMIT?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_MAPS_OWNER_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_MAPS_OWNER_LIMIT?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  N8N_MENU_IMPORT_WEBHOOK?: string;

  @IsOptional()
  @IsString()
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;

  @IsOptional()
  @IsString()
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;

  @IsOptional()
  @IsString()
  INTERNAL_NOTIFICATIONS_SECRET?: string;

  @IsOptional()
  @IsString()
  NOTIFICATION_DEVICES_STORE_PATH?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_AUTH_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_AUTH_LIMIT?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_SENSITIVE_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_SENSITIVE_LIMIT?: number;

  @IsOptional()
  @IsString()
  APP_ANDROID_LATEST_VERSION?: string;

  @IsOptional()
  @IsString()
  APP_ANDROID_MINIMUM_VERSION?: string;

  @IsOptional()
  @IsString()
  APP_ANDROID_FORCE_UPDATE?: string;

  @IsOptional()
  @IsString()
  APP_ANDROID_STORE_URL?: string;

  @IsOptional()
  @IsString()
  APP_ANDROID_RELEASE_NOTES?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_APP_VERSION_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_APP_VERSION_LIMIT?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_HEALTH_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_HEALTH_LIMIT?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_INTERNAL_NOTIFICATIONS_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_INTERNAL_NOTIFICATIONS_LIMIT?: number;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }

  const nodeEnv = validated.NODE_ENV;
  const productionIssues: string[] = [];

  if (nodeEnv === 'production') {
    const jwt = validated.JWT_ACCESS_SECRET?.trim() ?? '';
    if (jwt.length < 32) {
      productionIssues.push(
        'JWT_ACCESS_SECRET is required in production (min 32 characters)',
      );
    }

    if ((validated.CORS_ORIGINS ?? '').trim() === '*') {
      productionIssues.push(
        'CORS_ORIGINS=* is forbidden in production; set an explicit allowlist',
      );
    }

    const internal = validated.INTERNAL_NOTIFICATIONS_SECRET?.trim() ?? '';
    if (internal.length < 32) {
      productionIssues.push(
        'INTERNAL_NOTIFICATIONS_SECRET is required in production (min 32 characters)',
      );
    }
  }

  if (productionIssues.length > 0) {
    throw new Error(
      `Environment validation failed:\n${productionIssues.join('\n')}`,
    );
  }

  return validated;
}
