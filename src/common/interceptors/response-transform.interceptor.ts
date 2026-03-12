import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      map((body: unknown) => {
        const statusCode = response?.statusCode ?? 200;
        const defaultMessage =
          statusCode === 201 ? 'Data berhasil dibuat.' : 'Berhasil.';

        if (body && typeof body === 'object') {
          const payload = body as Record<string, unknown>;

          if (
            'status' in payload &&
            'message' in payload &&
            'data' in payload
          ) {
            return {
              status: 'success',
              message:
                typeof payload.message === 'string' && payload.message.length > 0
                  ? payload.message
                  : defaultMessage,
              data: this.toArray(payload.data),
            };
          }
        }

        if (typeof body === 'string') {
          return {
            status: 'success',
            message: body,
            data: [],
          };
        }

        return {
          status: 'success',
          message: defaultMessage,
          data: this.toArray(body),
        };
      }),
    );
  }

  private toArray(value: unknown): unknown[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }
}
