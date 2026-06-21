import { Module } from '@nestjs/common';
import { EnsBackendModule } from '../../infrastructure/ens-backend/ens-backend.module';
import { StaffAppController } from './staff-app.controller';
import { StaffOrderEnrichmentService } from './staff-order-enrichment.service';

@Module({
  imports: [EnsBackendModule],
  controllers: [StaffAppController],
  providers: [StaffOrderEnrichmentService],
})
export class StaffAppModule {}
