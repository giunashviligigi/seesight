import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiGenerateParams,
  AiGenerateResult,
  AiProvider,
} from './ai-provider.interface';

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generate(params: AiGenerateParams): Promise<AiGenerateResult> {
    const apiKey = this.config.get<string>('ai.geminiApiKey') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI provider is not configured (missing GEMINI_API_KEY)',
      );
    }

    const model =
      this.config.get<string>('ai.geminiModel') ?? 'gemini-2.0-flash';
    const baseUrl =
      this.config.get<string>('ai.geminiBaseUrl') ??
      'https://generativelanguage.googleapis.com/v1beta';

    const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: params.systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: params.userPrompt }],
            },
          ],
          generationConfig: {
            temperature: params.temperature,
            maxOutputTokens: params.maxOutputTokens,
            responseMimeType: 'application/json',
          },
        }),
      });
    } catch (error) {
      this.logger.warn('Gemini request failed to connect');
      throw new BadGatewayException(
        'AI provider is temporarily unavailable',
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException(
        'AI provider returned an invalid response',
      );
    }

    if (!response.ok) {
      this.logger.warn(`Gemini HTTP ${response.status}`);
      throw new BadGatewayException(
        'AI provider request failed',
      );
    }

    const text = extractGeminiText(body);
    if (!text) {
      throw new BadGatewayException(
        'AI provider returned an empty recommendation',
      );
    }

    return {
      text,
      provider: this.name,
      model,
    };
  }
}

function extractGeminiText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const content = (candidates[0] as { content?: unknown }).content;
  if (typeof content !== 'object' || content === null) {
    return null;
  }

  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) {
    return null;
  }

  const texts = parts
    .map((part) =>
      typeof part === 'object' &&
      part !== null &&
      'text' in part &&
      typeof (part as { text: unknown }).text === 'string'
        ? (part as { text: string }).text
        : '',
    )
    .filter(Boolean);

  return texts.length > 0 ? texts.join('\n') : null;
}
