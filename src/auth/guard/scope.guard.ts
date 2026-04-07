import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { $Enums } from '@prisma/client';
import { Observable } from 'rxjs';
import { JWTProp } from '../type/jwt.type';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private scope: $Enums.scope) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const permissions =
      (request?.organizationToken?.scope as $Enums.scope[]) ||
      (request?.user as JWTProp)?.scope ||
      (request?.scope as $Enums.scope[]);
    if (permissions?.includes(this?.scope)) {
      return true;
    }
    throw new UnauthorizedException();
  }
}
