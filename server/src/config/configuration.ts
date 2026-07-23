function normalizeOrigin(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/\/+$/, '');
}

function resolveCorsOrigins(): string {
  const fromCors = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
  const webOrigin = normalizeOrigin(process.env.WEB_ORIGIN);
  const origins = [...fromCors];
  if (webOrigin && !origins.includes(webOrigin)) {
    origins.push(webOrigin);
  }
  if (origins.length === 0) {
    origins.push('http://localhost:3000');
  }
  return origins.join(',');
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Empty CORS_ORIGIN on Railway used to yield [""] and block every browser origin.
  corsOrigin: resolveCorsOrigins(),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-change-me-seesight-jwt',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  authCookie: {
    name: process.env.AUTH_COOKIE_NAME ?? 'seesight_access_token',
  },
  app: {
    webOrigin: normalizeOrigin(process.env.WEB_ORIGIN) ?? 'http://localhost:3000',
  },
  serpapi: {
    apiKey: process.env.SERPAPI_API_KEY ?? '',
    baseUrl: process.env.SERPAPI_BASE_URL ?? 'https://serpapi.com/search.json',
    cacheTtlMs: parseInt(process.env.SERPAPI_CACHE_TTL_MS ?? '60000', 10),
    rateLimitPerMinute: parseInt(
      process.env.SERPAPI_RATE_LIMIT_PER_MINUTE ?? '30',
      10,
    ),
  },
  ai: {
    provider: (process.env.AI_PROVIDER ?? 'gemini').toLowerCase(),
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    geminiBaseUrl:
      process.env.GEMINI_BASE_URL ??
      'https://generativelanguage.googleapis.com/v1beta',
    groqApiKey: process.env.GROQ_API_KEY ?? '',
    groqModel: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    groqBaseUrl:
      process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
    maxOutputTokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS ?? '1024', 10),
    maxOffersPerType: parseInt(process.env.AI_MAX_OFFERS_PER_TYPE ?? '8', 10),
    rateLimitPerMinute: parseInt(
      process.env.AI_RATE_LIMIT_PER_MINUTE ?? '10',
      10,
    ),
    temperature: parseFloat(process.env.AI_TEMPERATURE ?? '0.2'),
  },
});
