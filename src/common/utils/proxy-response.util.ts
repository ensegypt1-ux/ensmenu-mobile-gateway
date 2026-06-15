import { Response } from 'express';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';
import { EnsHttpResult } from '../../infrastructure/ens-backend/ens-http.service';

export function sendProxyResponse(
  res: Response,
  result: EnsHttpResult,
  assetUrlService: AssetUrlService,
): void {
  const body = assetUrlService.rewriteDeep(result.data);
  res.status(result.status).json(body);
}
