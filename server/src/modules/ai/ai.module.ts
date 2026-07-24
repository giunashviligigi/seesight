import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import {
  AI_PROVIDER,
  type AiProvider,
} from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';

@Module({
  controllers: [AiController],
  providers: [
    GeminiProvider,
    GroqProvider,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, GeminiProvider, GroqProvider],
      useFactory: (
        config: ConfigService,
        gemini: GeminiProvider,
        groq: GroqProvider,
      ): AiProvider => {
        const name = (config.get<string>('ai.provider') ?? 'gemini').toLowerCase();
        if (name === 'groq') {
          return groq;
        }
        return gemini;
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
