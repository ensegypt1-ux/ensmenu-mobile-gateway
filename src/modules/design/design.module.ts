import { Module } from '@nestjs/common';
import { DesignController } from './design.controller';

@Module({
  controllers: [DesignController],
})
export class DesignModule {}
