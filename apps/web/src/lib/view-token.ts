/**
 * Per-tournament spectator "view tokens" issued by `POST /t/:slug/unlock`
 * for password-protected tournaments. Stored in localStorage so the gate
 * stays unlocked for 7 days (token lifetime) on this device.
 */
const PREFIX = 'bracket_view_token:';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getViewToken(slug: string): string | null {
  const s = storage();
  if (!s || !slug) return null;
  const raw = s.getItem(PREFIX + slug);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token: string; exp: number };
    if (parsed.exp && parsed.exp < Date.now()) {
      s.removeItem(PREFIX + slug);
      return null;
    }
    return parsed.token;
  } catch {
    return raw;
  }
}

export function setViewToken(slug: string, token: string, ttlMs = 7 * 24 * 3600_000) {
  const s = storage();
  if (!s || !slug) return;
  s.setItem(PREFIX + slug, JSON.stringify({ token, exp: Date.now() + ttlMs }));
}

export function clearViewToken(slug: string) {
  storage()?.removeItem(PREFIX + slug);
}

/** Extract the tournament slug from an API path like `/t/my-cup/export/x.csv`. */
export function slugFromApiPath(path: string): string | null {
  const m = /^\/t\/([^/?#]+)/.exec(path);
  return m ? decodeURIComponent(m[1]) : null;
}
