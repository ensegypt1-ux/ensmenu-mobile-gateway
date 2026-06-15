import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { EnsHttpService } from './ens-http.service';
import { ApiKeyService } from './api-key.service';
import { AssetUrlService } from '../storage/asset-url.service';

@Global()
@Module({
  imports: [HttpModule.register({ maxRedirects: 0 })],
  providers: [EnsHttpService, ApiKeyService, AssetUrlService],
  exports: [EnsHttpService, ApiKeyService, AssetUrlService],
})
export class EnsBackendModule {}
