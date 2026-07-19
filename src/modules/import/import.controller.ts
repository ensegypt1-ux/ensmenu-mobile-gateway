import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { MenuOwnershipGuard } from '../../common/guards/menu-ownership.guard';
import { SensitiveThrottle } from '../../common/decorators/throttle.decorators';
import { ALLOWED_IMAGE_MIME_TYPES } from '../../common/utils/image-file.util';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';
import { ImportService } from './import.service';

const IMPORT_FILE_SIZE = 10 * 1024 * 1024;

function importFileInterceptor() {
  return FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: IMPORT_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => {
      const mime = (file.mimetype || '').toLowerCase();
      // Magic bytes validated after buffer is available in ImportService.
      if (
        !mime ||
        ALLOWED_IMAGE_MIME_TYPES.has(mime) ||
        mime === 'application/octet-stream'
      ) {
        cb(null, true);
        return;
      }
      cb(
        new BadRequestException({
          error: 'invalid_file_type',
          errorAr: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP',
          code: 'IMPORT_INVALID_FILE_TYPE',
        }),
        false,
      );
    },
  });
}

/** Flutter Phase 1 alias paths — exact match required. */
@Controller('owner/menus/:menuId')
@UseGuards(OwnerOnlyGuard, MenuOwnershipGuard)
export class ImportAliasController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
    private readonly importService: ImportService,
  ) {}

  @SensitiveThrottle()
  @Post('import')
  @UseInterceptors(importFileInterceptor())
  async analyzeAlias(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { locale?: string },
  ) {
    if (!file) {
      return res.status(400).json({
        error: 'File is required',
        errorAr: 'الملف مطلوب',
        code: 'IMPORT_FILE_REQUIRED',
      });
    }

    const result = await this.importService.analyzeMenuImage({
      menuId,
      locale: body.locale ?? 'ar',
      file,
    });
    return res.status(200).json(result);
  }

  @Get('categories/bulk/canuse')
  async canUseAlias(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/categories/bulk/canuse`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @SensitiveThrottle()
  @Post('categories/bulk')
  async saveAlias(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: `menus/${menuId}/categories/bulk`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}

/** Canonical import routes under /mobile/v1/menus/:menuId/import/* */
@Controller('mobile/v1/menus/:menuId/import')
@UseGuards(OwnerOnlyGuard, MenuOwnershipGuard)
export class ImportCanonicalController {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
    private readonly importService: ImportService,
  ) {}

  @SensitiveThrottle()
  @Post('analyze')
  @UseInterceptors(importFileInterceptor())
  async analyze(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { locale?: string },
  ) {
    if (!file) {
      return res.status(400).json({
        error: 'File is required',
        errorAr: 'الملف مطلوب',
        code: 'IMPORT_FILE_REQUIRED',
      });
    }

    const result = await this.importService.analyzeMenuImage({
      menuId,
      locale: body.locale ?? 'ar',
      file,
    });
    return res.status(200).json(result);
  }

  @Get('can-use')
  async canUse(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/categories/bulk/canuse`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @SensitiveThrottle()
  @Post('save')
  async save(
    @Req() req: Request,
    @Res() res: Response,
    @Param('menuId') menuId: string,
    @Body() body: unknown,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: `menus/${menuId}/categories/bulk`,
      req,
      body,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
