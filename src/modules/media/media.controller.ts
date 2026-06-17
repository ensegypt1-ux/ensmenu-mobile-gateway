import {
  Body,
  Controller,
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

const MEDIA_FIELDS = [
  'socialFacebook',
  'socialInstagram',
  'socialTwitter',
  'socialWhatsapp',
  'addressAr',
  'addressEn',
  'phone',
  'workingHours',
] as const;

/** Canonical-only convenience routes; Flutter Phase 1 uses PUT /owner/menus/:id directly. */
@Controller('mobile/v1/menus/:menuId/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @Get()
  async getMedia(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}`,
      req,
    });

    if (
      result.status >= 200 &&
      result.status < 300 &&
      result.data &&
      typeof result.data === 'object'
    ) {
      const menu = result.data as Record<string, unknown>;
      const subset: Record<string, unknown> = {};
      for (const field of MEDIA_FIELDS) {
        if (field in menu) {
          subset[field] = menu[field];
        }
      }
      return sendProxyResponse(
        res,
        { status: result.status, data: subset },
        this.assetUrlService,
      );
    }

    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Put()
  async updateMedia(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'PUT',
      path: `menus/${menuId}`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
