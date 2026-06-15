import { Module } from '@nestjs/common';
import { VerifykitController } from './verifykit.controller';

@Module({
  controllers: [VerifykitController],
})
export class VerifykitModule {}
