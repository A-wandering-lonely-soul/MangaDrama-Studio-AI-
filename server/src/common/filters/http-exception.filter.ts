import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message = this.normalizeMessage(payload, exception.message);

      response.status(status).json({
        success: false,
        error: {
          statusCode: status,
          message,
          path: request.url,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '服务器内部错误',
        path: request.url,
        timestamp: new Date().toISOString()
      }
    });
  }

  private normalizeMessage(payload: string | object, fallback: string): string {
    if (typeof payload === 'string') {
      return payload;
    }

    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const message = Reflect.get(payload, 'message');
      if (Array.isArray(message)) {
        return message.join('；');
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return fallback;
  }
}
