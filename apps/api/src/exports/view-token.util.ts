import { JwtService } from '@nestjs/jwt';

export type ViewTokenPayload = { slug: string; kind: 'view' };

function secret(): string {
  return process.env.JWT_SECRET ?? 'dev-secret';
}

let cached: JwtService | null = null;
function service(): JwtService {
  if (!cached) cached = new JwtService({ secret: secret() });
  return cached;
}

/** Sign a 7-day view token for a password-protected tournament. */
export function signViewToken(slug: string): string {
  const payload: ViewTokenPayload = { slug, kind: 'view' };
  return service().sign(payload, { expiresIn: '7d' });
}

/**
 * Verify a view token issued by `POST /t/:slug/unlock`. Standalone so it can
 * be used from TournamentsService without injecting JwtService.
 */
export function verifyViewToken(
  token: string | undefined | null,
  slug: string,
): boolean {
  if (!token) return false;
  try {
    const payload = service().verify<ViewTokenPayload>(token);
    return payload?.kind === 'view' && payload.slug === slug;
  } catch {
    return false;
  }
}
