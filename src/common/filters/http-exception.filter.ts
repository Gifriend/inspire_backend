import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const normalizedException =
      exception instanceof HttpException
        ? exception
        : new InternalServerErrorException('Terjadi kesalahan internal server.');

    const status = normalizedException.getStatus();
    const exceptionResponse = normalizedException.getResponse();

    let message: string;
    let data: unknown[] = [];

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      // Validation errors dari ValidationPipe menyimpan detail di "errors"
      if (resp['errors']) {
        message = (resp['message'] as string) ?? 'Terjadi kesalahan validasi.';
        data = Array.isArray(resp['errors']) ? (resp['errors'] as unknown[]) : [resp['errors']];
      } else {
        if (Array.isArray(resp['message'])) {
          message = resp['message'].join(', ');
          data = resp['message'];
        } else {
          message = (resp['message'] as string) ?? 'Terjadi kesalahan.';
          if (resp['data'] !== undefined) {
            data = Array.isArray(resp['data']) ? (resp['data'] as unknown[]) : [resp['data']];
          }
        }
      }
    } else {
      message = 'Terjadi kesalahan.';
    }

    response.status(status).json({
      status: status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'error' : 'fail',
      message,
      data,
    });
  }
}
