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
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { MenuOwnershipGuard } from '../../common/guards/menu-ownership.guard';
import { RequireMenuOwnership } from '../../common/decorators/require-menu-ownership.decorator';
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

type MediaField = (typeof MEDIA_FIELDS)[number];

function pickMediaFields(body: unknown): Partial<Record<MediaField, unknown>> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const source = body as Record<string, unknown>;
  const subset: Partial<Record<MediaField, unknown>> = {};
  for (const field of MEDIA_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      subset[field] = source[field];
    }
  }
  return subset;
}

/** Canonical-only convenience routes; Flutter Phase 1 uses PUT /owner/menus/:id directly. */
@Controller('mobile/v1/menus/:menuId/media')
@UseGuards(OwnerOnlyGuard, MenuOwnershipGuard)
export class MediaController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
  ) {}

  @RequireMenuOwnership()
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
      body: pickMediaFields(body),
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
