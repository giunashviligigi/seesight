import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SerpApiSearchParams = Record<
  string,
  string | number | boolean | undefined
>;

@Injectable()
export class SerpApiClient {
  constructor(private readonly config: ConfigService) {}

  async search<T = Record<string, unknown>>(
    params: SerpApiSearchParams,
  ): Promise<T> {
    const apiKey = this.config.get<string>('serpapi.apiKey') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Travel search is not configured (missing SERPAPI_API_KEY)',
      );
    }

    const baseUrl =
      this.config.get<string>('serpapi.baseUrl') ??
      'https://serpapi.com/search.json';

    const query = new URLSearchParams();
    query.set('api_key', apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      query.set(key, String(value));
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}?${query.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new BadGatewayException(
        'Travel search provider is temporarily unavailable',
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException(
        'Travel search provider returned an invalid response',
      );
    }

    if (!response.ok) {
      const message =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : 'Travel search provider request failed';
      throw new BadGatewayException(message);
    }

    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
    ) {
      throw new BadGatewayException((body as { error: string }).error);
    }

    return body as T;
  }
}
