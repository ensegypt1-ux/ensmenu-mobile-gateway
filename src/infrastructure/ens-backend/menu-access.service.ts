import { ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { getAuthIdentity } from '../../common/utils/jwt-payload.util';
import { assertSafePathSegment } from '../../common/utils/upstream-path.util';

const ALLOW_CACHE_TTL_MS = 60_000;
const ALLOW_CACHE_MAX = 2_000;

/**
 * Best-effort gateway ownership gate via authenticated GET menus/:menuId.
 * Short TTL allow-cache reduces duplicate checks (mutate then read, analytics, …).
 */
@Injectable()
export class MenuAccessService {
  private readonly allowCache = new Map<
    string,
    { expiresAt: number }
  >();

  constructor(private readonly ensHttp: EnsHttpService) {}

  async assertOwnerCanAccessMenu(
    req: Request,
    menuIdRaw: string,
  ): Promise<string> {
    const menuId = assertSafePathSegment(menuIdRaw, 'menuId');
    const userId = getAuthIdentity(req)?.userId;
    const cacheKey =
      userId != null && userId > 0 ? `${userId}:${menuId}` : null;

    if (cacheKey) {
      const hit = this.allowCache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        return menuId;
      }
    }

    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}`,
      req,
    });

    if (result.status >= 200 && result.status < 300) {
      if (cacheKey) {
        this.rememberAllow(cacheKey);
      }
      return menuId;
    }

    if (cacheKey) {
      this.allowCache.delete(cacheKey);
    }

    if (result.status === 401 || result.status === 403) {
      throw new ForbiddenException({
        error: 'You do not have access to this menu',
        errorAr: 'ليس لديك صلاحية على هذه القائمة',
        code: 'MENU_ACCESS_DENIED',
      });
    }

    if (result.status === 404) {
      throw new ForbiddenException({
        error: 'Menu not found or not accessible',
        errorAr: 'القائمة غير موجودة أو غير متاحة',
        code: 'MENU_ACCESS_DENIED',
      });
    }

    throw new ForbiddenException({
      error: 'Unable to verify menu access',
      errorAr: 'تعذر التحقق من صلاحية القائمة',
      code: 'MENU_ACCESS_DENIED',
    });
  }

  private rememberAllow(cacheKey: string): void {
    if (this.allowCache.size >= ALLOW_CACHE_MAX) {
      const oldest = this.allowCache.keys().next().value;
      if (oldest != null) this.allowCache.delete(oldest);
    }
    this.allowCache.set(cacheKey, {
      expiresAt: Date.now() + ALLOW_CACHE_TTL_MS,
    });
  }
}
