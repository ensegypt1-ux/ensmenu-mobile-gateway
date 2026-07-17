import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

// TODO: remove owner/menus alias after Flutter migration (Phase 3)
@Controller([
  'mobile/v1/menus/:menuId/activity-logs',
  'owner/menus/:menuId/activity-logs',
])
@UseGuards(JwtAuthGuard)
export class ActivityController {
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
      path: `menus/${menuId}/activity-logs`,
      req,
      query,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get(':id')
  async getOne(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('id') id: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/activity-logs/${id}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post(':id/actions')
  async postAction(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: `menus/${menuId}/activity-logs/${id}/actions`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Patch(':id/items')
  async patchItems(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PATCH',
      path: `menus/${menuId}/activity-logs/${id}/items`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
