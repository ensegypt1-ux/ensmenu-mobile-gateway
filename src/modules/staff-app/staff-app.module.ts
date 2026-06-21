import { Module } from '@nestjs/common';
import { EnsBackendModule } from '../../infrastructure/ens-backend/ens-backend.module';
import { StaffAppController } from './staff-app.controller';

@Module({
  imports: [EnsBackendModule],
  controllers: [StaffAppController],
})
export class StaffAppModule {}
