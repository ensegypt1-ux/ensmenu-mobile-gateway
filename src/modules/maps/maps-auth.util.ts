import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { decode as decodeJwt } from 'jsonwebtoken';
import { coerceUserId } from '../../common/utils/jwt-payload.util';

/**
 * Decode Owner/staff JWT claims without verifying the signature.
 *
 * Uses the named `decode` export (not `jsonwebtoken` default) so CJS/ESM interop
 * cannot throw TypeError on undefined.default.decode.
 *
 * Auth presence is enforced by JwtAuthGuard. Maps is gateway-terminated, so we
 * only read claims for staff rejection, expiry refresh signaling, and per-owner
 * rate-limit keys — without depending on local JWT secret verification.
 */
export function decodeBearerClaims(
  req: Request,
): Record<string, unknown> | null {
  const authorization = req.headers.authorization;
  if (
    typeof authorization !== 'string' ||
    !authorization.startsWith('Bearer ')
  ) {
    return null;
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    const payload = decodeJwt(token);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Assert Owner access for Maps proxy endpoints.
 * Returns a stable numeric Owner id for rate limiting, or throws a controlled
 * HTTP error (never a TypeError from missing auth context).
 */
export function assertOwnerMapsAccess(req: Request): { userId: number } {
  const claims = decodeBearerClaims(req);
  if (!claims) {
    throw new UnauthorizedException({
      error: 'Authentication required',
      errorAr: 'مطلوب تسجيل الدخول',
      code: 'AUTH_REQUIRED',
    });
  }

  const roleRaw = claims.role ?? claims.userRole;
  const role = typeof roleRaw === 'string' ? roleRaw.toLowerCase().trim() : '';
  const staffJobRoleRaw = claims.staffJobRole;
  const staffJobRole =
    typeof staffJobRoleRaw === 'string' && staffJobRoleRaw.trim()
      ? staffJobRoleRaw.trim()
      : undefined;

  if (staffJobRole != null || role === 'staff') {
    throw new ForbiddenException({
      error: 'Owner authentication required',
      errorAr: 'مطلوب تسجيل دخول المالك',
      code: 'OWNER_AUTH_REQUIRED',
    });
  }

  const exp = claims.exp;
  if (
    typeof exp === 'number' &&
    Number.isFinite(exp) &&
    exp * 1000 < Date.now()
  ) {
    throw new UnauthorizedException({
      error: 'Token expired',
      errorAr: 'انتهت صلاحية الرمز',
      code: 'TOKEN_EXPIRED',
    });
  }

  const userId = coerceUserId(claims.id ?? claims.userId ?? claims.sub);
  if (userId == null) {
    throw new UnauthorizedException({
      error: 'Invalid token payload',
      errorAr: 'محتوى رمز الدخول غير صالح',
      code: 'AUTH_INVALID_PAYLOAD',
    });
  }

  return { userId };
}
