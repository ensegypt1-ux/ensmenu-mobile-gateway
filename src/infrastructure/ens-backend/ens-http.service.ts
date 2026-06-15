import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosRequestConfig, Method } from 'axios';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { createFormData } from '../../common/utils/form-data.util';
import { pickForwardHeaders } from '../../common/utils/forward-headers.util';
import { ApiKeyService } from './api-key.service';

export interface EnsHttpResult {
  status: number;
  data: unknown;
}

export interface EnsProxyOptions {
  method: Method;
  path: string;
  req?: Request;
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  multipart?: {
    file: Express.Multer.File;
    fields?: Record<string, string | undefined>;
  };
}

/**
 * Proxies to Express legacy /api/* routes (not /api/owner/* — that prefix does not
 * exist in ens-new-menu-back-main server.ts).
 */
@Injectable()
export class EnsHttpService {
  private readonly apiBaseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly apiKeyService: ApiKeyService,
  ) {
    const backendUrl = this.configService.get<string>('ensBackendUrl');
    this.apiBaseUrl = `${backendUrl}/api`;
    this.defaultTimeoutMs =
      this.configService.get<number>('upstreamTimeoutMs') ?? 30000;
  }

  buildUrl(path: string, query?: Record<string, unknown>): string {
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(`${this.apiBaseUrl}/${normalizedPath}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          value.forEach((item) => url.searchParams.append(key, String(item)));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  async proxy(options: EnsProxyOptions): Promise<EnsHttpResult> {
    const headers: Record<string, string> = {
      ...(options.req ? pickForwardHeaders(options.req) : {}),
      ...(options.headers ?? {}),
    };

    if (!headers['x-api-key'] && this.apiKeyService.isConfigured()) {
      headers['x-api-key'] = this.apiKeyService.generateHeaderValue();
    }

    const config: AxiosRequestConfig = {
      method: options.method,
      url: this.buildUrl(options.path, options.query),
      headers,
      timeout: options.timeoutMs ?? this.defaultTimeoutMs,
      validateStatus: () => true,
    };

    if (options.multipart) {
      // Do not forward client multipart boundary — rebuild for upstream.
      delete headers['content-type'];
      delete headers['Content-Type'];

      const form = createFormData();

      if (options.multipart.fields?.type) {
        form.append('type', options.multipart.fields.type);
      }

      form.append('file', options.multipart.file.buffer, {
        filename: options.multipart.file.originalname,
        contentType: options.multipart.file.mimetype,
      });

      for (const [key, value] of Object.entries(options.multipart.fields ?? {})) {
        if (key === 'type' || value === undefined) {
          continue;
        }
        form.append(key, value);
      }

      config.data = form;
      config.headers = {
        ...headers,
        ...form.getHeaders(),
      };
      config.maxBodyLength = Infinity;
      config.maxContentLength = Infinity;
    } else if (options.body !== undefined && options.method !== 'GET') {
      config.data = options.body;
      if (!config.headers?.['content-type']) {
        config.headers = {
          ...config.headers,
          'content-type': 'application/json',
        };
      }
    }

    try {
      const response = await firstValueFrom(this.httpService.request(config));
      return {
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response) {
          return {
            status: error.response.status,
            data: error.response.data,
          };
        }
        if (error.code === 'ECONNABORTED') {
          return {
            status: 504,
            data: {
              error: 'Upstream request timed out',
              errorAr: 'انتهت مهلة الطلب',
              code: 'UPSTREAM_TIMEOUT',
            },
          };
        }
      }

      throw new ServiceUnavailableException({
        error: 'Upstream service unavailable',
        errorAr: 'الخدمة غير متاحة',
        code: 'UPSTREAM_UNAVAILABLE',
      });
    }
  }
}
