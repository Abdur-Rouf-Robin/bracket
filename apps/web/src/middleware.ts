import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/browse',
  '/search',
  '/features',
  '/pricing',
  '/help',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/bracket-generator',
  '/communities',
  '/events',
  '/api-docs',
  '/embed',
];
const PUBLIC_PREFIXES = [
  '/sports/',
  '/c/', // community pages
  '/e/', // event pages
  '/u/', // public user profiles
  '/p/', // participant access pages
  '/r/', // referee access pages
  '/formats/',
  '/help/',
];
const PUBLIC_TOURNAMENT =
  /^\/t\/[^/]+(\/bracket|\/mvp|\/embed|\/register|\/draw|\/schedule|\/standings|\/tv|\/print|\/qr|\/results|\/participants|\/scoreboard\/[^/]+|\/m\/[^/]+)?$/;
const AUTH_COOKIE = 'bracket_auth';

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return true;
  }
  // Public tournament view (spectators) — manage stays protected
  if (PUBLIC_TOURNAMENT.test(pathname)) {
    return true;
  }
  return false;
}

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(AUTH_COOKIE);
  const origin = publicOrigin(request);

  // Community/event manage consoles stay protected even though /c and /e are public.
  const isManageConsole = /^\/(c|e)\/[^/]+\/manage(\/|$)/.test(pathname);

  if (isPublicPath(pathname) && !isManageConsole) {
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
