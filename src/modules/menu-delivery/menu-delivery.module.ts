import { Module } from '@nestjs/common';
import { MenuDeliveryController } from './menu-delivery.controller';

@Module({
  controllers: [MenuDeliveryController],
})
export class MenuDeliveryModule {}
