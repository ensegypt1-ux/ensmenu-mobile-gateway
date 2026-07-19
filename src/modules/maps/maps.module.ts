import { Module } from '@nestjs/common';
import { MapsController } from './maps.controller';
import { MapsOwnerRateLimiter } from './maps-owner-rate-limiter';
import { MapsService } from './maps.service';

@Module({
  controllers: [MapsController],
  providers: [MapsService, MapsOwnerRateLimiter],
})
export class MapsModule {}
