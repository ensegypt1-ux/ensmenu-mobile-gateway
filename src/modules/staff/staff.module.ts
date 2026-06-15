import { Module } from '@nestjs/common';
import { EnsBackendModule } from '../../infrastructure/ens-backend/ens-backend.module';
import { StaffController } from './staff.controller';

@Module({
  imports: [EnsBackendModule],
  controllers: [StaffController],
})
export class StaffModule {}
