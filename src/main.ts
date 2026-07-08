import {
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Swagger/OpenAPI documentation (can be disabled via ENABLE_SWAGGER env)
  if (process.env.ENABLE_SWAGGER === 'true' || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('Reminder App API')
      .setDescription('REST API for the Reminder mobile app backend')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
