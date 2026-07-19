import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';

export interface PexelsPhotoSrc {
  original: string;
  large2x: string;
  large: string;
  medium: string;
  small: string;
  portrait: string;
  landscape: string;
  tiny: string;
}

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  src: PexelsPhotoSrc;
}

export interface PexelsSearchResponse {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
}

@Injectable()
export class ImagesService {
  constructor(private readonly configService: ConfigService) {}

  async searchPhotos(params: {
    query: string;
    page: number;
    perPage: number;
  }): Promise<PexelsSearchResponse> {
    const apiKey = this.configService.get<string>('pexelsApiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        error: 'pexels_not_configured',
        errorAr: 'خدمة البحث عن الصور غير مفعّلة',
        code: 'PEXELS_NOT_CONFIGURED',
      });
    }

    const url = new URL(PEXELS_SEARCH_URL);
    url.searchParams.set('query', params.query);
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('per_page', String(params.perPage));

    const response = await fetch(url, {
      headers: { Authorization: apiKey },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new ServiceUnavailableException({
        error: 'pexels_search_failed',
        errorAr: 'فشل البحث عن الصور',
        code: 'PEXELS_SEARCH_FAILED',
      });
    }

    return (await response.json()) as PexelsSearchResponse;
  }
}
