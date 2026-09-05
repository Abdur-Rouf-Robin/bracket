import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  429: 'rate_limited',
  500: 'internal_error',
};

/** Public API v1 error envelope: `{ error: { code, message, details? } }`. */
@Catch()
export class PublicApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('PublicApi');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'Something went wrong';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as unknown;
      if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'object') {
        const err = (body as { error: { code?: string; message?: string; details?: unknown } }).error;
        code = err.code ?? CODE_BY_STATUS[status] ?? 'error';
        message = err.message ?? exception.message;
        details = err.details;
      } else if (body && typeof body === 'object') {
        const rec = body as { message?: unknown; fieldErrors?: unknown; formErrors?: unknown };
        code = CODE_BY_STATUS[status] ?? 'error';
        if (typeof rec.message === 'string') message = rec.message;
        else if (Array.isArray(rec.message)) message = rec.message.join(', ');
        else message = exception.message;
        if (rec.fieldErrors || rec.formErrors) {
          code = status === 400 ? 'validation_error' : code;
          details = { fieldErrors: rec.fieldErrors, formErrors: rec.formErrors };
        }
      } else {
        code = CODE_BY_STATUS[status] ?? 'error';
        message = typeof body === 'string' ? body : exception.message;
      }
    } else {
      this.logger.error((exception as Error)?.message ?? String(exception), (exception as Error)?.stack);
    }

    res.status(status).json({
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    });
  }
}
