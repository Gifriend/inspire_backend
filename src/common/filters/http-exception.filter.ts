import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    let data: unknown = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      // Validation errors dari ValidationPipe menyimpan detail di "errors"
      if (resp['errors']) {
        message = (resp['message'] as string) ?? 'Terjadi kesalahan validasi.';
        data = resp['errors'];
      } else {
        message = (resp['message'] as string) ?? 'Terjadi kesalahan.';
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
