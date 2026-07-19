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

@Controller([
  'mobile/v1/menus/:menuId/staff-roles',
  'owner/menus/:menuId/staff-roles',
])
export class StaffRolesController {
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
      path: `menus/${menuId}/staff-roles`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get(':roleId')
  async getOne(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('roleId') roleId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/staff-roles/${roleId}`,
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
      path: `menus/${menuId}/staff-roles`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put(':roleId')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('roleId') roleId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menus/${menuId}/staff-roles/${roleId}`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete(':roleId')
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('roleId') roleId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `menus/${menuId}/staff-roles/${roleId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
