import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { SensitiveThrottle } from '../../common/decorators/throttle.decorators';
import { ImagesService } from './images.service';

const MAX_QUERY_LENGTH = 120;
const MAX_PAGE = 50;
const MAX_PER_PAGE = 30;

// TODO: remove owner/images alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/images', 'owner/images'])
@UseGuards(JwtAuthGuard, OwnerOnlyGuard)
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  /**
   * Proxy Pexels search — mirrors web `GET /api/pexels/search`.
   * Requires verified Owner JWT. Accepts `query` (web) or `q` (mobile alias).
   */
  @SensitiveThrottle()
  @Get('search')
  async search(
    @Query('query') queryParam?: string,
    @Query('q') qParam?: string,
    @Query('page') pageParam?: string,
    @Query('per_page') perPageParam?: string,
  ) {
    const query = (queryParam ?? qParam ?? '').trim();
    if (!query) {
      throw new BadRequestException({
        error: 'query_required',
        errorAr: 'كلمة البحث مطلوبة',
        code: 'QUERY_REQUIRED',
      });
    }
    if (query.length > MAX_QUERY_LENGTH) {
      throw new BadRequestException({
        error: 'query_too_long',
        errorAr: 'كلمة البحث طويلة جداً',
        code: 'QUERY_TOO_LONG',
      });
    }

    const page = Math.min(
      MAX_PAGE,
      Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1),
    );
    const perPage = Math.min(
      MAX_PER_PAGE,
      Math.max(1, Number.parseInt(perPageParam ?? '15', 10) || 15),
    );

    return this.imagesService.searchPhotos({ query, page, perPage });
  }
}
