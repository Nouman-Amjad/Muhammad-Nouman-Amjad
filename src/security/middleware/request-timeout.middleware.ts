import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestTimeoutMiddleware implements NestMiddleware {
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.timeoutMs = config.get<number>('REQUEST_TIMEOUT_MS', 15000);
  }

  use(_req: Request, res: Response, next: NextFunction): void {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          statusCode: 408,
          error: 'Request Timeout',
          message: 'Request exceeded the maximum allowed processing time',
        });
      }
    }, this.timeoutMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  }
}
