import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const messages = errors.map((err) => ({
        field: err.property,
        errors: Object.values(err.constraints ?? {}),
        ...(err.children?.length
          ? { children: err.children.map((c) => ({ field: c.property, errors: Object.values(c.constraints ?? {}) })) }
          : {}),
      }));
      return new BadRequestException({ message: 'Validation failed', errors: messages });
    },
  }));

  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();