import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { createFormData } from '../../common/utils/form-data.util';
import { assertSafePathSegment } from '../../common/utils/upstream-path.util';
import { extractJsonFromN8n, isN8nImportFailure } from './n8n-response.util';

export const IMPORT_ACCEPTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

function inferMimeType(filename: string, mimetype: string): string {
  const lower = (mimetype || '').toLowerCase();
  if (IMPORT_ACCEPTED_MIME_TYPES.has(lower)) {
    return lower === 'image/jpg' ? 'image/jpeg' : lower;
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return lower;
  }
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private resolveWebhookUrl(): string {
    const webhook = this.configService
      .get<string>('n8nMenuImportWebhook')
      ?.trim();
    if (!webhook) {
      throw new ServiceUnavailableException({
        error: 'AI import service is not configured',
        errorAr: 'خدمة استيراد المنيو غير مفعّلة',
        code: 'IMPORT_NOT_CONFIGURED',
      });
    }
    return webhook;
  }

  private upstreamMaxBytes(): number {
    const mb = this.configService.get<number>('uploadMaxMb') ?? 10;
    const configured =
      this.configService.get<number>('upstreamMaxContentLengthBytes') ??
      mb * 1024 * 1024;
    return Math.max(1024 * 1024, configured);
  }

  async analyzeMenuImage(params: {
    menuId: string;
    locale: string;
    file: Express.Multer.File;
  }): Promise<{ raw: unknown }> {
    const webhookUrl = this.resolveWebhookUrl();

    const menuId = assertSafePathSegment(params.menuId, 'menuId');
    const localeRaw = (params.locale ?? 'ar').trim().toLowerCase();
    const locale = localeRaw === 'en' ? 'en' : 'ar';

    const filename = params.file.originalname || 'menu-image.jpg';
    const mime = inferMimeType(filename, params.file.mimetype || '');

    if (!IMPORT_ACCEPTED_MIME_TYPES.has(mime)) {
      throw new BadRequestException({
        error: 'invalid_file_type',
        errorAr: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP',
        code: 'IMPORT_INVALID_FILE_TYPE',
      });
    }

    const normalizedMime = mime === 'image/jpg' ? 'image/jpeg' : mime;

    const maxBytes = this.upstreamMaxBytes();
    if (!params.file.buffer || params.file.buffer.length === 0) {
      throw new BadRequestException({
        error: 'File is required',
        errorAr: 'الملف مطلوب',
        code: 'IMPORT_FILE_REQUIRED',
      });
    }
    if (params.file.buffer.length > maxBytes) {
      throw new BadRequestException({
        error: 'file_too_large',
        errorAr: 'حجم الملف كبير جداً',
        code: 'IMPORT_FILE_TOO_LARGE',
      });
    }

    // Match ens-menu-main /api/menu-import upstream form fields.
    const form = createFormData();
    form.append('file', params.file.buffer, {
      filename,
      contentType: normalizedMime,
    });
    form.append('menuId', menuId);
    form.append('locale', locale);
    form.append('image', params.file.buffer, {
      filename,
      contentType: normalizedMime,
    });

    const timeoutMs =
      this.configService.get<number>('importTimeoutMs') ?? 90_000;

    try {
      const response = await firstValueFrom(
        this.httpService.post<string>(webhookUrl, form, {
          headers: form.getHeaders(),
          timeout: timeoutMs,
          maxBodyLength: maxBytes,
          maxContentLength: maxBytes,
          validateStatus: () => true,
          responseType: 'text',
          transformResponse: [(data) => data],
          maxRedirects: 0,
        }),
      );

      const rawText =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data ?? '');

      if (response.status < 200 || response.status >= 300) {
        this.logger.warn(
          `N8N webhook failed (${response.status}) for menu ${menuId}`,
        );

        const inactive =
          rawText.includes('not registered') ||
          rawText.includes('not found') ||
          response.status === 404;

        throw new BadGatewayException({
          error: inactive ? 'n8n_webhook_inactive' : 'webhook_failed',
          errorAr: inactive
            ? 'webhook n8n غير نشط — فعّل الـ workflow في n8n'
            : 'فشل تحليل الصورة عبر خدمة الذكاء الاصطناعي',
          code: inactive ? 'IMPORT_WEBHOOK_INACTIVE' : 'IMPORT_WEBHOOK_FAILED',
        });
      }

      let parsedBody: unknown;
      if (typeof response.data === 'object' && response.data !== null) {
        parsedBody = response.data;
      } else {
        parsedBody = tryParseJsonBody(rawText);
      }

      if (isN8nImportFailure(parsedBody)) {
        this.logger.warn(
          `Import INVALID_JSON menu=${menuId} error=${(parsedBody as { error?: string }).error}`,
        );
        throw new UnprocessableEntityException({
          error: 'invalid_response',
          errorAr:
            (parsedBody as { error?: string }).error === 'INVALID_JSON'
              ? 'لم نستطع استخراج أصناف من الصورة'
              : 'فشل تحليل استجابة الذكاء الاصطناعي',
          code: 'IMPORT_INVALID_RESPONSE',
        });
      }

      const extracted =
        parsedBody &&
        typeof parsedBody === 'object' &&
        (parsedBody as { success?: boolean }).success === true &&
        Array.isArray((parsedBody as { categories?: unknown }).categories)
          ? { categories: (parsedBody as { categories: unknown[] }).categories }
          : extractJsonFromN8n(rawText);

      if (extracted === null) {
        this.logger.warn(
          `Import parse failed menu=${menuId} responseLen=${rawText.length}`,
        );
        throw new UnprocessableEntityException({
          error: 'invalid_response',
          errorAr: 'لم نستطع استخراج أصناف من الصورة',
          code: 'IMPORT_INVALID_RESPONSE',
        });
      }

      const stats = countMenuPayload(extracted);
      this.logger.log(
        `Import analyze OK menu=${menuId} categories=${stats.categories} items=${stats.items}`,
      );

      return { raw: extracted };
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof UnprocessableEntityException ||
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      const axiosCode = (error as { code?: string })?.code;
      if (axiosCode === 'ECONNABORTED' || axiosCode === 'ETIMEDOUT') {
        throw new GatewayTimeoutException({
          error: 'timeout',
          errorAr: 'انتهت مهلة تحليل الصورة. حاول مرة أخرى',
          code: 'IMPORT_TIMEOUT',
        });
      }

      this.logger.error('Import analyze failed');
      throw new BadGatewayException({
        error: 'import_analyze_failed',
        errorAr: 'فشل تحليل الصورة',
        code: 'IMPORT_ANALYZE_FAILED',
      });
    }
  }
}

function countMenuPayload(payload: unknown): {
  categories: number;
  items: number;
} {
  if (!payload || typeof payload !== 'object') {
    return { categories: 0, items: 0 };
  }
  const record = payload as Record<string, unknown>;
  const cats = Array.isArray(record.categories)
    ? record.categories
    : Array.isArray(record.sections)
      ? record.sections
      : [];
  let items = 0;
  if (Array.isArray(cats)) {
    for (const cat of cats) {
      if (!cat || typeof cat !== 'object') continue;
      const c = cat as Record<string, unknown>;
      const list = (c.items ?? c.products ?? c.menu_items) as unknown;
      if (Array.isArray(list)) items += list.length;
    }
  }
  const rootItems = record.items ?? record.products ?? record.menu_items;
  if (Array.isArray(rootItems)) {
    items += rootItems.length;
  }
  return {
    categories: Array.isArray(cats) ? cats.length : rootItems ? 1 : 0,
    items,
  };
}

function tryParseJsonBody(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
