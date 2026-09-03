export const AUTH_COOKIE = 'bracket_auth';
export const TOKEN_COOKIE = 'bracket_token';
export const USER_COOKIE = 'bracket_user';

export function readClientCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

export function clearClientAuthCookies() {
  if (typeof document === 'undefined') return;
  for (const name of [AUTH_COOKIE, TOKEN_COOKIE, USER_COOKIE]) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function setClientAuthCookies(
  token: string,
  userJson: string,
) {
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${USER_COOKIE}=${encodeURIComponent(userJson)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
