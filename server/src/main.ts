import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  const allowedOrigins = (
    configService.get<string>('corsOrigin') ?? 'http://localhost:3000'
  )
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      const normalized = requestOrigin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalized)) {
        callback(null, requestOrigin);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SeeSight Business API')
    .setDescription('REST API for the SeeSight Business platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth(
      configService.get<string>('authCookie.name') ?? 'seesight_access_token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('port') ?? 3001;
  await app.listen(port);
}

void bootstrap();
