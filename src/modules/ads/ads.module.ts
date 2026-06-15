import { Module } from '@nestjs/common';
import { AdsController, MenuAdsController } from './ads.controller';

@Module({
  controllers: [MenuAdsController, AdsController],
})
export class AdsModule {}
