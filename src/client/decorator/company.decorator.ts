import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetCompany = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data) return request.company?.[data];
    return request?.company;
  },
);
