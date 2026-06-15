import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ImagesService } from './images.service';

// TODO: remove owner/images alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/images', 'owner/images'])
@UseGuards(JwtAuthGuard)
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  /**
   * Proxy Pexels search — mirrors web `GET /api/pexels/search`.
   * Accepts `query` (web) or `q` (mobile alias).
   */
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

    const page = Math.max(
      1,
      Number.parseInt(pageParam ?? '1', 10) || 1,
    );
    const perPage = Math.min(
      30,
      Math.max(1, Number.parseInt(perPageParam ?? '15', 10) || 15),
    );

    return this.imagesService.searchPhotos({ query, page, perPage });
  }
}
