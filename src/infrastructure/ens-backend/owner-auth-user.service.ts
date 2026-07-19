import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import {
  JwtUserPayload,
  getAuthIdentity,
  requireAuthIdentity,
} from '../../common/utils/jwt-payload.util';
import { isOwnerRole, isStaffRole } from '../../common/types/auth-identity';

/**
 * Resolves the authenticated owner from a request.
 * Prefers the JwtAuthGuard-verified identity (cryptographic).
 */
@Injectable()
export class OwnerAuthUserService {
  async resolveFromRequest(req: Request): Promise<JwtUserPayload> {
    const identity = getAuthIdentity(req) ?? requireAuthIdentity(req);

    if (isStaffRole(identity.role) || !isOwnerRole(identity.role)) {
      throw new UnauthorizedException({
        error: 'Owner authentication required',
        errorAr: 'مطلوب تسجيل دخول المالك',
        code: 'OWNER_AUTH_REQUIRED',
      });
    }

    return {
      userId: identity.userId,
      role: identity.role,
      menuId: identity.menuId,
      staffRoleId: identity.staffRoleId,
    };
  }
}
