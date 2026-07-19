import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
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

// TODO: remove owner/menus alias after Flutter migration (Phase 3)
@Controller([
  'mobile/v1/menus/:menuId/categories',
  'owner/menus/:menuId/categories',
])
@UseGuards(OwnerOnlyGuard, MenuOwnershipGuard)
export class CategoriesController {
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
      path: `menus/${menuId}/categories`,
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
      path: `menus/${menuId}/categories`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get(':categoryId')
  async getOne(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/categories/${categoryId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put(':categoryId')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menus/${menuId}/categories/${categoryId}`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete(':categoryId')
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `menus/${menuId}/categories/${categoryId}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
