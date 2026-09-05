import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_KEY_PREFIX, PUBLIC_API_RATE_LIMIT_PER_MINUTE, type ApiKeyScope } from '@bracket/shared';
import { ApiKeysService } from './api-keys.service';

export const REQUIRED_SCOPE = 'apiKeyScope';
/** Mark a public API handler as requiring the `write` scope. */
export const RequireScope = (scope: ApiKeyScope) => SetMetadata(REQUIRED_SCOPE, scope);

export type ApiKeyRequestUser = {
  id: string;
  apiKey: true;
  apiKeyId: string;
  scopes: ApiKeyScope[];
};

type Req = {
  headers: Record<string, string | string[] | undefined>;
  user?: ApiKeyRequestUser;
};

/** Sliding-window in-memory rate limiter (per API key). */
class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string): { ok: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return { ok: false, remaining: 0, resetMs: this.windowMs - (now - arr[0]) };
    }
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 5000) {
      // Opportunistic cleanup of idle keys.
      for (const [k, v] of this.hits) {
        if (!v.length || now - v[v.length - 1] > this.windowMs) this.hits.delete(k);
      }
    }
    return { ok: true, remaining: this.limit - arr.length, resetMs: this.windowMs };
  }
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly limiter = new RateLimiter(PUBLIC_API_RATE_LIMIT_PER_MINUTE, 60_000);

  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Req>();
    const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
    const raw = this.extract(req);
    if (!raw) {
      throw new UnauthorizedException({
        error: { code: 'unauthorized', message: 'Provide an API key via X-Api-Key or Authorization: Bearer brk_live_…' },
      });
    }
    const verified = await this.apiKeys.verify(raw).catch(() => {
      throw new UnauthorizedException({
        error: { code: 'invalid_api_key', message: 'Invalid or revoked API key' },
      });
    });

    const rl = this.limiter.check(verified.id);
    res.setHeader('X-RateLimit-Limit', String(PUBLIC_API_RATE_LIMIT_PER_MINUTE));
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.ok) {
      res.setHeader('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
      throw new HttpException(
        { error: { code: 'rate_limited', message: 'Rate limit exceeded (120 requests per minute)' } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const required = this.reflector.get<ApiKeyScope | undefined>(REQUIRED_SCOPE, context.getHandler());
    if (required && !verified.scopes.includes(required)) {
      throw new HttpException(
        { error: { code: 'insufficient_scope', message: `This endpoint requires the "${required}" scope` } },
        HttpStatus.FORBIDDEN,
      );
    }

    req.user = {
      id: verified.userId,
      apiKey: true,
      apiKeyId: verified.id,
      scopes: verified.scopes,
    };
    return true;
  }

  private extract(req: Req): string | null {
    const h = req.headers['x-api-key'];
    const direct = Array.isArray(h) ? h[0] : h;
    if (direct) return direct;
    const auth = req.headers.authorization;
    const a = Array.isArray(auth) ? auth[0] : auth;
    if (a?.startsWith('Bearer ')) {
      const token = a.slice(7).trim();
      if (token.startsWith(API_KEY_PREFIX)) return token;
    }
    return null;
  }
}
