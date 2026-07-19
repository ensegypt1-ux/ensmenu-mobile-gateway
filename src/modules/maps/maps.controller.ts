import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MapsThrottle } from '../../common/decorators/throttle.decorators';
import { assertOwnerMapsAccess } from './maps-auth.util';
import { MapsOwnerRateLimiter } from './maps-owner-rate-limiter';
import { MapsService } from './maps.service';

/**
 * Owner Maps proxy — JwtAuthGuard presence + claim-based Owner checks.
 * Does not use request.user / request.user.decoded (guards never set those).
 * Does not call OwnerAuthUserService (avoids local JWT secret mismatch).
 */
@Controller(['mobile/v1/maps', 'owner/maps'])
@UseGuards(JwtAuthGuard)
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
