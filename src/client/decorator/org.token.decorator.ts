import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetOrganizationToken = createParamDecorator(
  (_: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request?.organizationToken;
  },
);
