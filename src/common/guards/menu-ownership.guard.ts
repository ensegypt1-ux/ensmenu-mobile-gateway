import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_MENU_OWNERSHIP_KEY } from '../decorators/require-menu-ownership.decorator';
import { MenuAccessService } from '../../infrastructure/ens-backend/menu-access.service';

/**
 * Owner menu-scoped authorization:
 * - Mutations (POST/PUT/PATCH/DELETE) with `:menuId` always checked
 * - GETs only when marked `@RequireMenuOwnership()` (sensitive reads)
 * - Ordinary list/check-slug GETs skip the extra upstream round-trip
 */
@Injectable()
export class MenuOwnershipGuard implements CanActivate {
  constructor(
    private readonly menuAccess: MenuAccessService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = (request.method || 'GET').toUpperCase();
    const menuId = request.params?.menuId;

    if (typeof menuId !== 'string' || !menuId.trim()) {
      return true;
    }

    const isMutation =
      method === 'POST' ||
      method === 'PUT' ||
      method === 'PATCH' ||
      method === 'DELETE';

    const requireOnGet =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_MENU_OWNERSHIP_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    if (!isMutation && !(method === 'GET' && requireOnGet)) {
      return true;
    }

    await this.menuAccess.assertOwnerCanAccessMenu(request, menuId);
    return true;
  }
}
