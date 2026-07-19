import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

// TODO: remove owner/menus alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/menus/:menuId/ads', 'owner/menus/:menuId/ads'])
export class MenuAdsController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Get()
  async list(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/ads`,
      req,
      query,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: `menus/${menuId}/ads`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}

// TODO: remove owner/ads alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/ads', 'owner/ads'])
export class AdsController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Put(':adId')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('adId') adId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `ads/${adId}`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete(':adId')
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('adId') adId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `ads/${adId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Patch(':adId/toggle')
  async toggle(
    @Req() req: Request,
    @Res() res: Response,
    @Param('adId') adId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PATCH',
      path: `ads/${adId}/toggle`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
