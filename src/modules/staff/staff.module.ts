import { Module } from '@nestjs/common';
import { EnsBackendModule } from '../../infrastructure/ens-backend/ens-backend.module';
import { StaffController } from './staff.controller';
import { StaffPermissionsController } from './staff-permissions.controller';
import { StaffRolesController } from './staff-roles.controller';

@Module({
  imports: [EnsBackendModule],
  controllers: [
    StaffController,
    StaffRolesController,
    StaffPermissionsController,
  ],
})
export class StaffModule {}
