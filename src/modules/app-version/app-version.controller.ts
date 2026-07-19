import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AppVersionThrottle } from '../../common/decorators/throttle.decorators';
import { AppVersionService } from './app-version.service';

@Controller('mobile/v1/app')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  /** Public owner-app version check — no JWT. Light IP throttle against abuse. */
  @Public()
  @AppVersionThrottle()
  @Get('version')
  getVersion() {
    return this.appVersionService.getAndroidVersion();
  }
}
