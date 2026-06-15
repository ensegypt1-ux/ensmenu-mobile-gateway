import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import {
  ImportAliasController,
  ImportCanonicalController,
} from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [HttpModule],
  controllers: [ImportAliasController, ImportCanonicalController],
  providers: [ImportService],
})
export class ImportModule {}
