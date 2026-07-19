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

@Controller([
  'mobile/v1/menus/:menuId/delivery',
  'owner/menus/:menuId/delivery',
])
@UseGuards(OwnerOnlyGuard, MenuOwnershipGuard)
export class MenuDeliveryController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Get('settings')
  async getSettings(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/delivery/settings`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put('settings')
  async updateSettings(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menus/${menuId}/delivery/settings`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get('governorates')
  async getGovernorates(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/delivery/governorates`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post('governorates')
  async createGovernorate(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: `menus/${menuId}/delivery/governorates`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put('governorates/:governorateId')
  async updateGovernorate(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('governorateId') governorateId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menus/${menuId}/delivery/governorates/${governorateId}`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete('governorates/:governorateId')
  async deleteGovernorate(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('governorateId') governorateId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `menus/${menuId}/delivery/governorates/${governorateId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
