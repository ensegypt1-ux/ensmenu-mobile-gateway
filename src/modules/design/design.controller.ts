import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
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
  'mobile/v1/menus/:menuId/customizations',
  'owner/menus/:menuId/customizations',
])
@UseGuards(JwtAuthGuard)
export class DesignController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Get()
  async getOne(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/customizations`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put()
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menus/${menuId}/customizations`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete()
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `menus/${menuId}/customizations`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
