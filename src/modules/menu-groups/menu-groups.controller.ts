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

// TODO: remove owner/menu-groups alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/menu-groups', 'owner/menu-groups'])
export class MenuGroupsController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Get()
  async list(@Req() req: Request, @Res() res: Response) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: 'menu-groups',
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'menu-groups',
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put(':groupId')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('groupId') groupId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menu-groups/${groupId}`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Post(':groupId/menus')
  async addMenu(
    @Req() req: Request,
    @Res() res: Response,
    @Param('groupId') groupId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: `menu-groups/${groupId}/menus`,
      req,
      body: body ?? {},
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete(':groupId')
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('groupId') groupId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `menu-groups/${groupId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
