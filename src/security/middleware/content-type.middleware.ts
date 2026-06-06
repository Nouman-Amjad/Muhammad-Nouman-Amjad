import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

@Injectable()
export class ContentTypeMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!BODY_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.startsWith('application/json')) {
      res.status(415).json({
        statusCode: 415,
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json',
      });
      return;
    }

    next();
  }
}
