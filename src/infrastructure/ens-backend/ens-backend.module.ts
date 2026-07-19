import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { EnsHttpService } from './ens-http.service';
import { ApiKeyService } from './api-key.service';
import { AssetUrlService } from '../storage/asset-url.service';
import { OwnerAuthUserService } from './owner-auth-user.service';
import { MenuAccessService } from './menu-access.service';
import { MenuOwnershipGuard } from '../../common/guards/menu-ownership.guard';

@Global()
@Module({
  imports: [HttpModule.register({ maxRedirects: 0 })],
  providers: [
    EnsHttpService,
    ApiKeyService,
    AssetUrlService,
    OwnerAuthUserService,
    MenuAccessService,
    MenuOwnershipGuard,
  ],
  exports: [
    EnsHttpService,
    ApiKeyService,
    AssetUrlService,
    OwnerAuthUserService,
    MenuAccessService,
    MenuOwnershipGuard,
  ],
})
export class EnsBackendModule {}
