import { Module } from '@nestjs/common';
import { EnsBackendModule } from '../../infrastructure/ens-backend/ens-backend.module';
import { StaffAppController } from './staff-app.controller';
import { StaffOrderPresenterService } from './staff-order-presenter.service';

@Module({
  imports: [EnsBackendModule],
  controllers: [StaffAppController],
  providers: [StaffOrderPresenterService],
})
export class StaffAppModule {}
