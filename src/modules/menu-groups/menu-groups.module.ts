import { Module } from '@nestjs/common';
import { MenuGroupsController } from './menu-groups.controller';

@Module({
  controllers: [MenuGroupsController],
})
export class MenuGroupsModule {}
