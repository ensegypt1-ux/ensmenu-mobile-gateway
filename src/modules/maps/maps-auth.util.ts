import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { coerceUserId } from '../../common/utils/jwt-payload.util';

/**
 * Decode Owner/staff JWT claims without verifying the signature.
 * Auth presence is enforced by JwtAuthGuard; signature validation for Owner
 * traffic is deferred to Express on proxied routes. Maps is gateway-terminated,
 * so we only read claims for staff rejection, expiry refresh signaling, and
 * per-owner rate-limit keys — matching production tokens that local secrets
 * may not verify.
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
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return null;
  }
  return decoded as Record<string, unknown>;
}

export function assertOwnerMapsAccess(req: Request): {
  userId: number | null;
} {
  const claims = decodeBearerClaims(req);
  if (!claims) {
    // JwtAuthGuard should already reject missing Bearer; keep a hard stop.
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
  if (typeof exp === 'number' && Number.isFinite(exp) && exp * 1000 < Date.now()) {
    // Codes/messages aligned with OwnerApiClient refreshable expiry handling.
    throw new UnauthorizedException({
      error: 'Token expired',
      errorAr: 'انتهت صلاحية الرمز',
      code: 'TOKEN_EXPIRED',
    });
  }

  const userId = coerceUserId(claims.id ?? claims.userId ?? claims.sub);
  return { userId };
}
