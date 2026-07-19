import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { isOwnerRole, isStaffRole } from '../../common/types/auth-identity';
import { requireAuthIdentity } from '../../common/utils/jwt-payload.util';

/**
 * Assert Owner access for Maps using the JwtAuthGuard-verified identity.
 * Never decodes unsigned JWT payloads.
 */
export function assertOwnerMapsAccess(req: Request): { userId: number } {
  const identity = requireAuthIdentity(req);

  if (isStaffRole(identity.role) || !isOwnerRole(identity.role)) {
    throw new ForbiddenException({
      error: 'Owner authentication required',
      errorAr: 'مطلوب تسجيل دخول المالك',
      code: 'OWNER_AUTH_REQUIRED',
    });
  }

  if (!Number.isFinite(identity.userId) || identity.userId <= 0) {
    throw new UnauthorizedException({
      error: 'Invalid token payload',
      errorAr: 'محتوى رمز الدخول غير صالح',
      code: 'AUTH_INVALID_PAYLOAD',
    });
  }

  return { userId: identity.userId };
}
