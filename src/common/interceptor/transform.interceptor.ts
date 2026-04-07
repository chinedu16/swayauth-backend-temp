import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GenericResponse } from '..';

export interface Response<T> {
  data?: T;
}

const excludeKeys = [
  'password',
  'authorization_code',
  'signature',
  'totp_secret',
];

// const ignorePath = []
const ignorePath = ['/v1/payment/hook', '/v1/google'];

const deleteExclude = (data: any[] | any) => {
  if (data?.length) {
    for (let i = 0; i < data.length; i++) {
      for (let u = 0; u < excludeKeys.length; u++) {
        delete data[i][excludeKeys[u]];
      }
    }
  } else {
    for (let i = 0; i < excludeKeys.length; i++) {
      delete data[excludeKeys[i]];
    }
  }
};

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const requestUrl = context.switchToHttp().getRequest().url as string;
    if (!ignorePath.includes(requestUrl)) {
      return next.handle().pipe(
        map((data) => {
          let resData: GenericResponse = { data, status: true, message: 'Ok' };
          if (data?.data || data?.message) {
            if (data?.data) deleteExclude(data.data);
            resData = { ...resData, ...data };
            resData.message = data?.message || 'Ok';
          } else {
            if (data) deleteExclude(data);
          }
          return resData;
        }),
      );
    }
    return next.handle();
  }
}
