import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT auth when token present; otherwise continues with no user. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    if (!request.headers.authorization) return true;
    return (super.canActivate(context) as Promise<boolean>).catch(() => true);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
