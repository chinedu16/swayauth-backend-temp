import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetAdmin = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data) return request.admin?.[data];
    return request.admin;
  },
);
