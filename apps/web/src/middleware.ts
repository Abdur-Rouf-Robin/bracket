import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isManageConsole, isPublicPath } from '@/lib/public-paths';

const AUTH_COOKIE = 'bracket_auth';

function publicOrigin(request: NextRequest): string {
  const host = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(',')[0]
    .trim();
  const proto = (
    request.headers.get('x-forwarded-proto') ??
    request.nextUrl.protocol.replace(':', '')
  )
    .split(',')[0]
    .trim();
  if (
    host &&
    !/^localhost(:|$)/i.test(host) &&
    !/^127\.0\.0\.1(:|$)/.test(host)
  ) {
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
}

const PRIMARY_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'bracket.arrobin.com',
]);

async function communityRewrite(request: NextRequest) {
  const host = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(',')[0]!
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
  if (!host || PRIMARY_HOSTS.has(host)) return null;
  const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4200';
  try {
    const res = await fetch(
      `${api}/communities/by-domain?host=${encodeURIComponent(host)}`,
      { signal: AbortSignal.timeout(1200) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { slug?: string };
    if (!body.slug) return null;
    const url = request.nextUrl.clone();
    if (url.pathname === '/') url.pathname = `/c/${body.slug}`;
    return NextResponse.rewrite(url);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const rewrite = await communityRewrite(request);
  if (rewrite) return rewrite;

  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(AUTH_COOKIE);
  const origin = publicOrigin(request);

  if (isPublicPath(pathname) && !isManageConsole(pathname)) {
    if (hasSession && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', origin));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', origin);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
