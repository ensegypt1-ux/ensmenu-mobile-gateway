import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MapsThrottle } from '../../common/decorators/throttle.decorators';
import { OwnerAuthUserService } from '../../infrastructure/ens-backend/owner-auth-user.service';
import { MapsOwnerRateLimiter } from './maps-owner-rate-limiter';
import { MapsService } from './maps.service';

@Controller(['mobile/v1/maps', 'owner/maps'])
@UseGuards(JwtAuthGuard)
export class MapsController {
  constructor(
    private readonly mapsService: MapsService,
    private readonly ownerAuth: OwnerAuthUserService,
    private readonly ownerRateLimiter: MapsOwnerRateLimiter,
  ) {}

  private async authorize(req: Request): Promise<void> {
    const user = await this.ownerAuth.resolveFromRequest(req);
    if (
      user.staffJobRole != null ||
      (typeof user.role === 'string' &&
        user.role.toLowerCase().includes('staff'))
    ) {
      throw new UnauthorizedException({
        error: 'Owner authentication required',
        errorAr: 'مطلوب تسجيل دخول المالك',
        code: 'OWNER_AUTH_REQUIRED',
      });
    }
    this.ownerRateLimiter.check(user.userId);
  }

  /**
   * Places Autocomplete — returns placeId + display strings only.
   */
  @MapsThrottle()
  @Get('places/autocomplete')
  async autocomplete(
    @Req() req: Request,
    @Query('input') input?: string,
    @Query('language') language?: string,
  ) {
    await this.authorize(req);
    return this.mapsService.autocomplete({
      input: input ?? '',
      language: language === 'ar' ? 'ar' : 'en',
    });
  }

  /**
   * Place Details geometry only (lat/lng).
   */
  @MapsThrottle()
  @Get('places/details')
  async placeDetails(
    @Req() req: Request,
    @Query('placeId') placeId?: string,
    @Query('place_id') placeIdSnake?: string,
    @Query('language') language?: string,
  ) {
    await this.authorize(req);
    return this.mapsService.placeDetails({
      placeId: placeId ?? placeIdSnake ?? '',
      language: language === 'ar' ? 'ar' : 'en',
    });
  }

  /**
   * Forward geocode address → lat/lng.
   */
  @MapsThrottle()
  @Get('geocode')
  async geocode(
    @Req() req: Request,
    @Query('address') address?: string,
    @Query('language') language?: string,
  ) {
    await this.authorize(req);
    return this.mapsService.geocode({
      address: address ?? '',
      language: language === 'ar' ? 'ar' : 'en',
    });
  }
}
