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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { sendProxyResponse } from '../../common/utils/proxy-response.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import { AssetUrlService } from '../../infrastructure/storage/asset-url.service';

// TODO: remove owner/upload alias after Flutter migration (Phase 3)
@Controller(['mobile/v1/upload', 'owner/upload'])
@UseGuards(JwtAuthGuard)
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

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
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
