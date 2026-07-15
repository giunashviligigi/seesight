export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-change-me-seesight-jwt',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  authCookie: {
    name: process.env.AUTH_COOKIE_NAME ?? 'seesight_access_token',
  },
  app: {
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  },
});
