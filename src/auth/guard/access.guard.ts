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
export class AccessGuard implements CanActivate {
  constructor(private access: $Enums.access[]) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const access =
      (request?.user as JWTProp)?.access || (request?.access as $Enums.access);
    if (this?.access?.includes(access)) {
      return true;
    }
    throw new UnauthorizedException();
  }
}
