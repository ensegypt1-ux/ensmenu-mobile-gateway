import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

// TODO: remove owner/menus alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/menus/:menuId/tables', 'owner/menus/:menuId/tables'])
export class TablesController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Get()
  async list(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/tables`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get(':tableId')
  async getOne(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('tableId') tableId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/tables/${tableId}`,
      req,
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
      path: `menus/${menuId}/tables`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put(':tableId')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('tableId') tableId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menus/${menuId}/tables/${tableId}`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete(':tableId')
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('tableId') tableId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `menus/${menuId}/tables/${tableId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
