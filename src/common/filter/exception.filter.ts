import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { reportErrorToSlack } from '../util/slack';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception?.getStatus
      ? exception?.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception?.name?.includes('Prisma')
      ? 'Error, please try again later'
      : typeof exception?.response?.message === 'object'
        ? exception?.response?.message[0]
        : exception?.meta?.message ||
          exception?.meta?.cause ||
          exception?.response?.message ||
          exception?.message;

    reportErrorToSlack({ ...exception, ...request.headers });

    response.status(status).json({
      status: false,
      message,
      data: exception?.response?.data ?? null,
      $metadata: {
        ...exception?.options,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
