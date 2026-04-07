import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetRole = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data) return request.user[data];
    return request.user;
  },
);

export const GetCompanyOrUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (request.company) {
      return {
        data: data ? request.company[data] : request?.company,
        type: 'company',
      };
    } else {
      return { data: data ? request.user[data] : request?.user, type: 'user' };
    }
  },
);

export const GetAuthType = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.auth_type;
  },
);
