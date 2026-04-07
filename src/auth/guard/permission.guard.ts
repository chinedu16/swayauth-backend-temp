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
export class PermissionGuard implements CanActivate {
  constructor(private role: $Enums.permissions) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const permissions =
      (request?.user as JWTProp)?.permissions ||
      (request?.permissions as $Enums.permissions[]) ||
      (request?.organizationToken?.permissions as $Enums.permissions[]);
    if (permissions?.includes(this?.role)) {
      return true;
    }
    throw new UnauthorizedException();
  }
}
