import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { OwnerOnlyGuard } from '../../common/guards/role.guards';
import { SensitiveThrottle } from '../../common/decorators/throttle.decorators';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  resolveSafeImageContentType,
} from '../../common/utils/image-file.util';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

// TODO: remove owner/upload alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/upload', 'owner/upload'])
@UseGuards(OwnerOnlyGuard)
export class UploadController {
  private readonly uploadMaxBytes: number;

  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly assetUrlService: AssetUrlService,
    configService: ConfigService,
  ) {
    const maxMb = configService.get<number>('uploadMaxMb') ?? 10;
    this.uploadMaxBytes = maxMb * 1024 * 1024;
  }

  @SensitiveThrottle()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
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
            code: 'UPLOAD_INVALID_FILE_TYPE',
          }),
          false,
        );
      },
    }),
  )
  async upload(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, string | undefined>,
  ) {
    if (!file) {
      return res.status(400).json({
        error: 'File is required',
        errorAr: 'الملف مطلوب',
        code: 'UPLOAD_FILE_REQUIRED',
      });
    }

    if (file.size > this.uploadMaxBytes) {
      return res.status(413).json({
        error: 'File too large',
        errorAr: 'حجم الملف كبير جداً',
        code: 'UPLOAD_TOO_LARGE',
      });
    }

    const safeMime = resolveSafeImageContentType(file);
    if (!safeMime) {
      return res.status(400).json({
        error: 'invalid_file_type',
        errorAr: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP',
        code: 'UPLOAD_INVALID_FILE_TYPE',
      });
    }

    // Override client-supplied MIME with magic-byte detected type.
    file.mimetype = safeMime;

    const uploadType = body.type ?? req.body?.type;

    const result = await this.ensHttp.proxy({
      method: 'POST',
      path: 'upload',
      req,
      multipart: {
        file,
        fields: uploadType ? { type: uploadType } : undefined,
      },
    });

    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Delete(':filename')
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('filename') filename: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'DELETE',
      path: `upload/${filename}`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }

  @Get(':filename/info')
  async info(
    @Req() req: Request,
    @Res() res: Response,
    @Param('filename') filename: string,
  ) {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `upload/${filename}/info`,
      req,
    });
    sendProxyResponse(res, result, this.assetUrlService);
  }
}
