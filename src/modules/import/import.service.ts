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
import { extractJsonFromN8n, isN8nImportFailure } from './n8n-response.util';

const ACCEPTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const DEFAULT_WEBHOOK = 'https://ensbot.net/webhook/menu-import';

function inferMimeType(filename: string, mimetype: string): string {
  const lower = (mimetype || '').toLowerCase();
  if (ACCEPTED_MIME_TYPES.has(lower)) return lower;

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
    return (
      this.configService.get<string>('n8nMenuImportWebhook')?.trim() ||
      DEFAULT_WEBHOOK
    );
  }

  async analyzeMenuImage(params: {
    menuId: string;
    locale: string;
    file: Express.Multer.File;
  }): Promise<{ raw: unknown }> {
    const webhookUrl = this.resolveWebhookUrl();
    if (!webhookUrl) {
      throw new ServiceUnavailableException({
        error: 'AI import service is not configured',
        errorAr: 'خدمة استيراد المنيو غير مفعّلة',
        code: 'IMPORT_NOT_CONFIGURED',
      });
    }

    const filename = params.file.originalname || 'menu-image.jpg';
    const mime = inferMimeType(filename, params.file.mimetype || '');

    if (!ACCEPTED_MIME_TYPES.has(mime)) {
      throw new BadRequestException({
        error: 'invalid_file_type',
        errorAr: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP',
        code: 'IMPORT_INVALID_FILE_TYPE',
      });
    }

    const locale = params.locale?.trim() || 'ar';
    const menuId = params.menuId.trim();

    // Match ens-menu-main /api/menu-import upstream form fields.
    const form = createFormData();
    form.append('file', params.file.buffer, {
      filename,
      contentType: mime,
    });
    form.append('menuId', menuId);
    form.append('locale', locale);
    form.append('image', params.file.buffer, {
      filename,
      contentType: mime,
    });

    const timeoutMs =
      this.configService.get<number>('importTimeoutMs') ?? 90_000;

    try {
      const response = await firstValueFrom(
        this.httpService.post<string>(webhookUrl, form, {
          headers: form.getHeaders(),
          timeout: timeoutMs,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          validateStatus: () => true,
          responseType: 'text',
          transformResponse: [(data) => data],
        }),
      );

      const rawText =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data ?? '');

      if (response.status < 200 || response.status >= 300) {
        this.logger.warn(
          `N8N webhook failed (${response.status}) for menu ${menuId}: ${rawText.slice(0, 300)}`,
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
          detail: rawText.slice(0, 500),
        });
      }

      // n8n Code node may return JSON object directly (not string).
      let parsedBody: unknown;
      if (typeof response.data === 'object' && response.data !== null) {
        parsedBody = response.data;
      } else {
        parsedBody = tryParseJsonBody(rawText);
      }

      if (isN8nImportFailure(parsedBody)) {
        this.logger.warn(
          `Import INVALID_JSON menu=${menuId} error=${parsedBody.error} ` +
            `rawPreview=${String(parsedBody.raw ?? '').slice(0, 200)}`,
        );
        throw new UnprocessableEntityException({
          error: 'invalid_response',
          errorAr:
            parsedBody.error === 'INVALID_JSON'
              ? 'لم نستطع استخراج أصناف من الصورة'
              : 'فشل تحليل استجابة الذكاء الاصطناعي',
          code: 'IMPORT_INVALID_RESPONSE',
          detail: String(parsedBody.raw ?? rawText).slice(0, 500),
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
          `Import parse failed menu=${menuId} responseLen=${rawText.length} ` +
            `preview=${rawText.slice(0, 200)}`,
        );
        throw new UnprocessableEntityException({
          error: 'invalid_response',
          errorAr: 'لم نستطع استخراج أصناف من الصورة',
          code: 'IMPORT_INVALID_RESPONSE',
          detail: rawText.slice(0, 500),
        });
      }

      const stats = countMenuPayload(extracted);
      this.logger.log(
        `Import analyze OK menu=${menuId} categories=${stats.categories} items=${stats.items}`,
      );

      // Frontend MenuImportApiResponse shape.
      return { raw: extracted };
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof UnprocessableEntityException ||
        error instanceof BadRequestException
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

      this.logger.error('Import analyze failed', error as Error);
      throw new BadGatewayException({
        error: 'import_analyze_failed',
        errorAr: 'فشل تحليل الصورة',
        code: 'IMPORT_ANALYZE_FAILED',
        detail: error instanceof Error ? error.message : String(error),
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
