import {
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter (catches all errors in one place)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe with custom error factory
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Validation failed',
          details: errors.map((e) => ({
            field: e.property,
            constraint: Object.values(e.constraints ?? {}).join(', '),
          })),
        }),
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
