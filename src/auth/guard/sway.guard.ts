import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SwayGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const api_key = request.headers['swayauth-identifier'] as
      | string
      | undefined;
    if (api_key !== process.env.SWAYAUTH_IDENTITY) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
