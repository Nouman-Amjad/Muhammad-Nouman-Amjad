import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../../shared/domain/domain-error';
import { ErrorCode } from '../../shared/errors/error-codes';

const DOMAIN_CODE_TO_HTTP: Readonly<Record<string, number>> = {
  [ErrorCode.QuotaExhausted]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.Forbidden]: HttpStatus.FORBIDDEN,
  [ErrorCode.NotFound]: HttpStatus.NOT_FOUND,
  [ErrorCode.Unauthorized]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.Validation]: HttpStatus.BAD_REQUEST,
  [ErrorCode.InvalidTokenUsage]: HttpStatus.BAD_REQUEST,
  [ErrorCode.InvalidQuota]: HttpStatus.BAD_REQUEST,
  SUBSCRIPTION_NOT_FOUND: HttpStatus.NOT_FOUND,
  SUBSCRIPTION_ALREADY_CANCELLED: HttpStatus.CONFLICT,
  SUBSCRIPTION_NOT_ACTIVE: HttpStatus.CONFLICT,
};

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(
        typeof body === 'object'
          ? { ...(body as Record<string, unknown>), timestamp: new Date().toISOString() }
          : { statusCode: status, message: body, timestamp: new Date().toISOString() },
      );
      return;
    }

    if (exception instanceof DomainError) {
      const status = DOMAIN_CODE_TO_HTTP[exception.code] ?? HttpStatus.BAD_REQUEST;
      res.status(status).json({
        statusCode: status,
        error: exception.code,
        message: exception.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    this.logger.error(
      { path: req.url, error: String(exception) },
      'Unhandled exception',
    );

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  }
}
