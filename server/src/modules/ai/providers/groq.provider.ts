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

/**
 * Groq OpenAI-compatible chat completions.
 * Docs: https://console.groq.com/docs/api-reference
 */
@Injectable()
export class GroqProvider implements AiProvider {
  readonly name = 'groq';
  private readonly logger = new Logger(GroqProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generate(params: AiGenerateParams): Promise<AiGenerateResult> {
    const apiKey = this.config.get<string>('ai.groqApiKey') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI provider is not configured (missing GROQ_API_KEY)',
      );
    }

    const model =
      this.config.get<string>('ai.groqModel') ?? 'llama-3.3-70b-versatile';
    const baseUrl =
      this.config.get<string>('ai.groqBaseUrl') ??
      'https://api.groq.com/openai/v1';

    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: params.systemInstruction },
            { role: 'user', content: params.userPrompt },
          ],
          temperature: params.temperature,
          max_tokens: params.maxOutputTokens,
          response_format: { type: 'json_object' },
        }),
      });
    } catch {
      this.logger.warn('Groq request failed to connect');
      throw new BadGatewayException('AI provider is temporarily unavailable');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException('AI provider returned an invalid response');
    }

    if (!response.ok) {
      const message =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error?: { message?: unknown } }).error?.message ===
          'string'
          ? (body as { error: { message: string } }).error.message
          : `HTTP ${response.status}`;
      this.logger.warn(`Groq HTTP ${response.status}: ${message}`);
      throw new BadGatewayException('AI provider request failed');
    }

    const text = extractGroqText(body);
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

function extractGroqText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) {
    return null;
  }

  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' && content.trim().length > 0
    ? content
    : null;
}
