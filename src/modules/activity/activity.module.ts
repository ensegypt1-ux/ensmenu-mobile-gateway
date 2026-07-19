import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  controllers: [ActivityController, AuditLogsController],
})
export class ActivityModule {}
