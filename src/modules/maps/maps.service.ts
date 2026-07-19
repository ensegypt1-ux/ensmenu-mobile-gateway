import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const AUTOCOMPLETE_URL =
  'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export type MapsPredictionDto = {
  placeId: string;
  description: string;
  mainText: string | null;
  secondaryText: string | null;
};

export type MapsLatLngDto = {
  latitude: number;
  longitude: number;
};

/**
 * Server-side Google Places + Geocoding proxy.
 * The API key never leaves the gateway process and must not appear in logs.
 */
@Injectable()
export class MapsService {
  constructor(private readonly configService: ConfigService) {}

  private requireApiKey(): string {
    const key = this.configService.get<string>('googleMapsServerApiKey')?.trim();
    if (!key) {
      throw new ServiceUnavailableException({
        error: 'maps_not_configured',
        errorAr: 'خدمة الخرائط غير مفعّلة',
        code: 'MAPS_NOT_CONFIGURED',
      });
    }
    return key;
  }

  private timeoutMs(): number {
    return this.configService.get<number>('mapsUpstreamTimeoutMs') ?? 8_000;
  }

  private async fetchGoogleJson(
    url: URL,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new ServiceUnavailableException({
          error: 'maps_upstream_failed',
          errorAr: 'فشل الاتصال بخدمة الخرائط',
          code: 'MAPS_UPSTREAM_FAILED',
        });
      }
      return (await response.json()) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new ServiceUnavailableException({
        error: 'maps_upstream_timeout',
        errorAr: 'انتهت مهلة خدمة الخرائط',
        code: 'MAPS_UPSTREAM_TIMEOUT',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private assertGoogleStatus(status: unknown, zeroOk = false): void {
    const s = typeof status === 'string' ? status : '';
    if (s === 'OK' || (zeroOk && s === 'ZERO_RESULTS')) return;
    if (s === 'ZERO_RESULTS') return;
    if (s === 'INVALID_REQUEST') {
      throw new BadRequestException({
        error: 'maps_invalid_request',
        errorAr: 'طلب خرائط غير صالح',
        code: 'MAPS_INVALID_REQUEST',
      });
    }
    if (s === 'OVER_QUERY_LIMIT' || s === 'OVER_DAILY_LIMIT') {
      throw new HttpException(
        {
          error: 'maps_quota_exceeded',
          errorAr: 'تم تجاوز حد طلبات الخرائط',
          code: 'MAPS_QUOTA_EXCEEDED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw new ServiceUnavailableException({
      error: 'maps_upstream_error',
      errorAr: 'خطأ من خدمة الخرائط',
      code: 'MAPS_UPSTREAM_ERROR',
    });
  }

  async autocomplete(params: {
    input: string;
    language: string;
  }): Promise<{ predictions: MapsPredictionDto[] }> {
    const input = params.input.trim();
    if (!input) {
      throw new BadRequestException({
        error: 'input_required',
        errorAr: 'نص البحث مطلوب',
        code: 'INPUT_REQUIRED',
      });
    }
    if (input.length > 200) {
      throw new BadRequestException({
        error: 'input_too_long',
        errorAr: 'نص البحث طويل جداً',
        code: 'INPUT_TOO_LONG',
      });
    }

    const apiKey = this.requireApiKey();
    const url = new URL(AUTOCOMPLETE_URL);
    url.searchParams.set('input', input);
    url.searchParams.set('language', params.language === 'ar' ? 'ar' : 'en');
    url.searchParams.set('components', 'country:eg');
    url.searchParams.set('key', apiKey);

    const data = await this.fetchGoogleJson(url);
    this.assertGoogleStatus(data.status, true);

    const raw = Array.isArray(data.predictions) ? data.predictions : [];
    const predictions: MapsPredictionDto[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const placeId = typeof row.place_id === 'string' ? row.place_id : '';
      const description =
        typeof row.description === 'string' ? row.description : '';
      if (!placeId || !description) continue;
      const structured =
        row.structured_formatting &&
        typeof row.structured_formatting === 'object'
          ? (row.structured_formatting as Record<string, unknown>)
          : null;
      predictions.push({
        placeId,
        description,
        mainText:
          typeof structured?.main_text === 'string'
            ? structured.main_text
            : null,
        secondaryText:
          typeof structured?.secondary_text === 'string'
            ? structured.secondary_text
            : null,
      });
    }

    return { predictions };
  }

  async placeDetails(params: {
    placeId: string;
    language: string;
  }): Promise<MapsLatLngDto> {
    const placeId = params.placeId.trim();
    if (!placeId) {
      throw new BadRequestException({
        error: 'place_id_required',
        errorAr: 'معرّف المكان مطلوب',
        code: 'PLACE_ID_REQUIRED',
      });
    }
    if (
      placeId.length > 512 ||
      /\s/.test(placeId) ||
      !/^[A-Za-z0-9_\-.=]+$/.test(placeId)
    ) {
      throw new BadRequestException({
        error: 'place_id_invalid',
        errorAr: 'معرّف المكان غير صالح',
        code: 'PLACE_ID_INVALID',
      });
    }

    const apiKey = this.requireApiKey();
    const url = new URL(DETAILS_URL);
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'geometry');
    url.searchParams.set('language', params.language === 'ar' ? 'ar' : 'en');
    url.searchParams.set('key', apiKey);

    const data = await this.fetchGoogleJson(url);
    this.assertGoogleStatus(data.status);

    const result =
      data.result && typeof data.result === 'object'
        ? (data.result as Record<string, unknown>)
        : null;
    const geometry =
      result?.geometry && typeof result.geometry === 'object'
        ? (result.geometry as Record<string, unknown>)
        : null;
    const location =
      geometry?.location && typeof geometry.location === 'object'
        ? (geometry.location as Record<string, unknown>)
        : null;
    const lat = typeof location?.lat === 'number' ? location.lat : NaN;
    const lng = typeof location?.lng === 'number' ? location.lng : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ServiceUnavailableException({
        error: 'maps_geometry_missing',
        errorAr: 'تعذر قراءة إحداثيات المكان',
        code: 'MAPS_GEOMETRY_MISSING',
      });
    }

    return { latitude: lat, longitude: lng };
  }

  async geocode(params: {
    address: string;
    language: string;
  }): Promise<MapsLatLngDto> {
    const address = params.address.trim();
    if (!address) {
      throw new BadRequestException({
        error: 'address_required',
        errorAr: 'العنوان مطلوب',
        code: 'ADDRESS_REQUIRED',
      });
    }
    if (address.length > 300) {
      throw new BadRequestException({
        error: 'address_too_long',
        errorAr: 'العنوان طويل جداً',
        code: 'ADDRESS_TOO_LONG',
      });
    }

    const apiKey = this.requireApiKey();
    const url = new URL(GEOCODE_URL);
    url.searchParams.set('address', address);
    url.searchParams.set('language', params.language === 'ar' ? 'ar' : 'en');
    url.searchParams.set('region', 'eg');
    url.searchParams.set('key', apiKey);

    const data = await this.fetchGoogleJson(url);
    this.assertGoogleStatus(data.status);

    const results = Array.isArray(data.results) ? data.results : [];
    const first =
      results[0] && typeof results[0] === 'object'
        ? (results[0] as Record<string, unknown>)
        : null;
    const geometry =
      first?.geometry && typeof first.geometry === 'object'
        ? (first.geometry as Record<string, unknown>)
        : null;
    const location =
      geometry?.location && typeof geometry.location === 'object'
        ? (geometry.location as Record<string, unknown>)
        : null;
    const lat = typeof location?.lat === 'number' ? location.lat : NaN;
    const lng = typeof location?.lng === 'number' ? location.lng : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ServiceUnavailableException({
        error: 'maps_geometry_missing',
        errorAr: 'تعذر قراءة إحداثيات العنوان',
        code: 'MAPS_GEOMETRY_MISSING',
      });
    }

    return { latitude: lat, longitude: lng };
  }
}
