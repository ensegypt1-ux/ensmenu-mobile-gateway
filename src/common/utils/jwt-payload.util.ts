import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

export interface JwtUserPayload {
  userId: number;
  role?: string;
}

export function coerceUserId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function collectAccessTokenSecrets(configService: ConfigService): string[] {
  const candidates = [
    configService.get<string>('jwtAccessSecret'),
    configService.get<string>('jwtSecret'),
  ];

  return [
    ...new Set(
      candidates
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length >= 32),
    ),
  ];
}

function payloadToUser(payload: jwt.JwtPayload): JwtUserPayload | null {
  const userId = coerceUserId(payload.id ?? payload.userId ?? payload.sub);
  if (userId == null) return null;

  const roleRaw = payload.role ?? payload.userRole;
  const role = typeof roleRaw === 'string' ? roleRaw : undefined;

  return { userId, role };
}

/** Verifies access token locally when gateway JWT secrets match the issuer. */
export function verifyAccessTokenLocally(
  req: Request,
  configService: ConfigService,
): JwtUserPayload | null {
  const authorization = req.headers.authorization;
  if (
    typeof authorization !== 'string' ||
    !authorization.startsWith('Bearer ')
  ) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  for (const secret of collectAccessTokenSecrets(configService)) {
    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      return payloadToUser(payload);
    } catch {
      // Try the next configured secret.
    }
  }

  return null;
}

export function extractJwtUser(
  req: Request,
  configService: ConfigService,
): JwtUserPayload {
  const authorization = req.headers.authorization;
  if (
    typeof authorization !== 'string' ||
    !authorization.startsWith('Bearer ')
  ) {
    throw new UnauthorizedException({
      error: 'Authentication required',
      errorAr: 'مطلوب تسجيل الدخول',
      code: 'AUTH_REQUIRED',
    });
  }

  const localUser = verifyAccessTokenLocally(req, configService);
  if (localUser) return localUser;

  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';
  const hasAnySecret = collectAccessTokenSecrets(configService).length > 0;

  if (!hasAnySecret && nodeEnv !== 'development') {
    throw new UnauthorizedException({
      error: 'Authentication service misconfigured',
      errorAr: 'خدمة المصادقة غير مهيأة',
      code: 'AUTH_MISCONFIGURED',
    });
  }

  throw new UnauthorizedException({
    error: 'Invalid or expired token',
    errorAr: 'رمز الدخول غير صالح أو منتهي الصلاحية',
    code: 'AUTH_INVALID_TOKEN',
  });
}
