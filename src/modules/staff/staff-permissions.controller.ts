import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

@Controller(['mobile/v1/staff-permissions', 'owner/staff-permissions'])
export class StaffPermissionsController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Get('catalog')
  async getCatalog(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'staff-permissions/catalog',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
