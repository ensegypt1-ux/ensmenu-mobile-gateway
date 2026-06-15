import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { ItemsController } from './items.controller';

@Module({
  controllers: [CategoriesController, ItemsController],
})
export class CatalogModule {}
