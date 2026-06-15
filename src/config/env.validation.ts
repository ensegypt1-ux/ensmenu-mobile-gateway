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
  PEXELS_API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  N8N_MENU_IMPORT_WEBHOOK?: string;
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

  return validated;
}
