import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { MapsThrottle } from '../../common/decorators/throttle.decorators';
import { assertOwnerMapsAccess } from './maps-auth.util';
import { MapsOwnerRateLimiter } from './maps-owner-rate-limiter';
import { MapsService } from './maps.service';

/**
 * Owner Maps proxy — requires verified Owner JWT (global JwtAuthGuard + OwnerOnlyGuard).
 * Per-owner rate limit uses verified userId only (not client-supplied identity).
 */
@Controller(['mobile/v1/maps', 'owner/maps'])
@UseGuards(OwnerOnlyGuard)
export class MapsController {
  constructor(
    private readonly mapsService: MapsService,
    private readonly ownerRateLimiter: MapsOwnerRateLimiter,
  ) {}

  private authorize(req: Request): void {
    const { userId } = assertOwnerMapsAccess(req);
    this.ownerRateLimiter.check(userId);
  }

  @MapsThrottle()
  @Get('places/autocomplete')
  async autocomplete(
    @Req() req: Request,
    @Query('input') input?: string,
    @Query('language') language?: string,
  ) {
    this.authorize(req);
    return this.mapsService.autocomplete({
      input: input ?? '',
      language: language === 'ar' ? 'ar' : 'en',
    });
  }

  @MapsThrottle()
  @Get('places/details')
  async placeDetails(
    @Req() req: Request,
    @Query('placeId') placeId?: string,
    @Query('place_id') placeIdSnake?: string,
    @Query('language') language?: string,
  ) {
    this.authorize(req);
    return this.mapsService.placeDetails({
      placeId: placeId ?? placeIdSnake ?? '',
      language: language === 'ar' ? 'ar' : 'en',
    });
  }

  @MapsThrottle()
  @Get('geocode')
  async geocode(
    @Req() req: Request,
    @Query('address') address?: string,
    @Query('language') language?: string,
  ) {
    this.authorize(req);
    return this.mapsService.geocode({
      address: address ?? '',
      language: language === 'ar' ? 'ar' : 'en',
    });
  }
}
