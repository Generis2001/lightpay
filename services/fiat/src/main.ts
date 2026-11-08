import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { migrateDatabase } from './database/migrate';
import { AppModule } from './app.module';

async function bootstrap() {
  await migrateDatabase();
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://app.lightpay.ng']
      : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('LightPay Fiat Service')
      .setDescription('Wallets, transfers, and bills API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.FIAT_PORT ?? 3002;
  await app.listen(port, process.env.SERVICE_BIND_HOST ?? '0.0.0.0');
  console.log(`Fiat service running on port ${port}`);
}

bootstrap().catch(() => { console.error('Service startup failed; check database migrations and configuration.'); process.exitCode = 1; });
