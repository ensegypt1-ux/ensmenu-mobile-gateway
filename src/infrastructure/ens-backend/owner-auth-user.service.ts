import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  JwtUserPayload,
  coerceUserId,
  verifyAccessTokenLocally,
} from '../../common/utils/jwt-payload.util';
import { EnsHttpService } from './ens-http.service';

/**
 * Resolves the authenticated owner from a request.
 * Prefers local JWT verification; falls back to upstream Express `/auth/me`
 * so proxied login tokens remain valid even when gateway JWT env differs.
 */
@Injectable()
export class OwnerAuthUserService {
  constructor(
    private readonly configService: ConfigService,
    private readonly ensHttp: EnsHttpService,
  ) {}

  async resolveFromRequest(req: Request): Promise<JwtUserPayload> {
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

    const localUser = verifyAccessTokenLocally(req, this.configService);
    if (localUser) return localUser;

    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'auth/me',
      req,
    });

    if (result.status !== 200) {
      throw new UnauthorizedException({
        error: 'Invalid or expired token',
        errorAr: 'رمز الدخول غير صالح أو منتهي الصلاحية',
        code: 'AUTH_INVALID_TOKEN',
      });
    }

    const data = result.data;
    if (!data || typeof data !== 'object') {
      throw new UnauthorizedException({
        error: 'Invalid user response',
        errorAr: 'استجابة المستخدم غير صالحة',
        code: 'AUTH_INVALID_PAYLOAD',
      });
    }

    const user = (data as Record<string, unknown>).user;
    if (!user || typeof user !== 'object') {
      throw new UnauthorizedException({
        error: 'Invalid token payload',
        errorAr: 'محتوى رمز الدخول غير صالح',
        code: 'AUTH_INVALID_PAYLOAD',
      });
    }

    const userRecord = user as Record<string, unknown>;
    const userId = coerceUserId(userRecord.id ?? userRecord.userId);
    if (userId == null) {
      throw new UnauthorizedException({
        error: 'Invalid token payload',
        errorAr: 'محتوى رمز الدخول غير صالح',
        code: 'AUTH_INVALID_PAYLOAD',
      });
    }

    const role =
      typeof userRecord.role === 'string' ? userRecord.role : undefined;

    return { userId, role };
  }
}
