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
  UseGuards,
} from '@nestjs/common';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { MenuOwnershipGuard } from '../../common/guards/menu-ownership.guard';
import { Request, Response } from 'express';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

@Controller(['mobile/v1/menus/:menuId/staff', 'owner/menus/:menuId/staff'])
@UseGuards(OwnerOnlyGuard, MenuOwnershipGuard)
export class StaffController {
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
      path: `menus/${menuId}/staff`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get(':staffId')
  async getOne(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('staffId') staffId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/staff/${staffId}`,
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
      path: `menus/${menuId}/staff`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put(':staffId')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('staffId') staffId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menus/${menuId}/staff/${staffId}`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete(':staffId')
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('staffId') staffId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `menus/${menuId}/staff/${staffId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
