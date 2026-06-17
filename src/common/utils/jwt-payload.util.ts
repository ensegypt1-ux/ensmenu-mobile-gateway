import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

export interface JwtUserPayload {
  userId: number;
  role?: string;
}

function coerceUserId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
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

  const token = authorization.slice('Bearer '.length).trim();
  const secret = configService.get<string>('jwtAccessSecret')?.trim();
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';

  if (!secret) {
    if (nodeEnv !== 'development') {
      throw new UnauthorizedException({
        error: 'Authentication service misconfigured',
        errorAr: 'خدمة المصادقة غير مهيأة',
        code: 'AUTH_MISCONFIGURED',
      });
    }
    throw new UnauthorizedException({
      error: 'JWT validation is not configured',
      errorAr: 'التحقق من رمز الدخول غير مهيأ',
      code: 'AUTH_MISCONFIGURED',
    });
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret) as jwt.JwtPayload;
  } catch {
    throw new UnauthorizedException({
      error: 'Invalid or expired token',
      errorAr: 'رمز الدخول غير صالح أو منتهي الصلاحية',
      code: 'AUTH_INVALID_TOKEN',
    });
  }

  const userId = coerceUserId(payload.id ?? payload.userId ?? payload.sub);
  if (userId == null) {
    throw new UnauthorizedException({
      error: 'Invalid token payload',
      errorAr: 'محتوى رمز الدخول غير صالح',
      code: 'AUTH_INVALID_PAYLOAD',
    });
  }

  const roleRaw = payload.role ?? payload.userRole;
  const role = typeof roleRaw === 'string' ? roleRaw : undefined;

  return { userId, role };
}
