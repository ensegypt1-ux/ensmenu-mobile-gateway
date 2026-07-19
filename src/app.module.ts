import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { UpstreamExceptionFilter } from './common/filters/upstream-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { EnsBackendModule } from './infrastructure/ens-backend/ens-backend.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AdsModule } from './modules/ads/ads.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DesignModule } from './modules/design/design.module';
import { HealthModule } from './modules/health/health.module';
import { ImportModule } from './modules/import/import.module';
import { MediaModule } from './modules/media/media.module';
import { MenuDeliveryModule } from './modules/menu-delivery/menu-delivery.module';
import { MenuGroupsModule } from './modules/menu-groups/menu-groups.module';
import { MenusModule } from './modules/menus/menus.module';
import { UploadModule } from './modules/upload/upload.module';
import { ImagesModule } from './modules/images/images.module';
import { MapsModule } from './modules/maps/maps.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentModule } from './modules/payment/payment.module';
import { StaffModule } from './modules/staff/staff.module';
import { StaffAppModule } from './modules/staff-app/staff-app.module';
import { TablesModule } from './modules/tables/tables.module';
import { UserModule } from './modules/user/user.module';
import { VerifykitModule } from './modules/verifykit/verifykit.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.get<number>('throttleTtlMs') ?? 60_000,
          limit: config.get<number>('throttleLimit') ?? 120,
        },
      ],
    }),
    EnsBackendModule,
    HealthModule,
    AuthModule,
    UserModule,
    MenusModule,
    MenuGroupsModule,
    MenuDeliveryModule,
    BranchesModule,
    CatalogModule,
    UploadModule,
    ImagesModule,
    MapsModule,
    DesignModule,
    MediaModule,
    AdsModule,
    ImportModule,
    ActivityModule,
    PaymentModule,
    VerifykitModule,
    VouchersModule,
    TablesModule,
    StaffModule,
    StaffAppModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: UpstreamExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
