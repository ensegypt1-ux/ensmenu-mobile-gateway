import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { isOwnerRole, isStaffRole } from '../types/auth-identity';
import { getAuthIdentity } from '../utils/jwt-payload.util';

/**
 * Gateway-terminated Owner services (Maps, Images, Import analyze, Owner devices).
 * Requires a cryptographically verified non-staff identity.
 */
@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const identity = getAuthIdentity(request);

    if (!identity) {
      throw new UnauthorizedException({
        error: 'Authentication required',
        errorAr: 'مطلوب تسجيل الدخول',
        code: 'AUTH_REQUIRED',
      });
    }

    if (isStaffRole(identity.role) || !isOwnerRole(identity.role)) {
      throw new ForbiddenException({
        error: 'Owner authentication required',
        errorAr: 'مطلوب تسجيل دخول المالك',
        code: 'OWNER_AUTH_REQUIRED',
      });
    }

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}

/**
 * Staff-only Gateway services (Staff app order/auth flows except public login).
 */
@Injectable()
export class StaffOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const identity = getAuthIdentity(request);

    if (!identity) {
      throw new UnauthorizedException({
        error: 'Authentication required',
        errorAr: 'مطلوب تسجيل الدخول',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!isStaffRole(identity.role)) {
      throw new ForbiddenException({
        error: 'Staff authentication required',
        errorAr: 'مطلوب تسجيل دخول الموظف',
        code: 'STAFF_AUTH_REQUIRED',
      });
    }

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
