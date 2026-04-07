import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TimeOutInterceptor implements NestInterceptor {
  constructor(private seconds: number = 120) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.setTimeout(this.seconds * 1000); // Set timeout to 60 seconds (adjust as needed)
    return next.handle();
  }
}
