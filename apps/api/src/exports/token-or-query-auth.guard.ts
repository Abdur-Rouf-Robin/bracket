import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../auth/jwt.strategy';

type AuthedRequest = {
  headers: { authorization?: string };
  query: Record<string, string | string[] | undefined>;
  user?: { id: string; email: string; name: string; role?: string };
};

/**
 * Accepts a Bearer token in the Authorization header OR `?access_token=<jwt>`
 * in the query string. Used for download links (CSV/PDF) that browsers open
 * directly and therefore cannot send custom headers.
 */
@Injectable()
export class TokenOrQueryAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    let token: string | undefined;
    if (header?.startsWith('Bearer ')) token = header.slice(7).trim();
    if (!token) {
      const q = req.query.access_token;
      token = Array.isArray(q) ? q[0] : q;
    }
    if (!token) throw new UnauthorizedException('Missing access token');
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      if (!payload?.sub) throw new Error('no sub');
      req.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name ?? '',
        role: payload.role ?? 'USER',
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
