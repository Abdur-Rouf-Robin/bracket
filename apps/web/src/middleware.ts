import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/browse'];
const PUBLIC_TOURNAMENT =
  /^\/t\/[^/]+(\/bracket|\/mvp|\/embed|\/register|\/draw|\/scoreboard\/[^/]+)?$/;
const AUTH_COOKIE = 'bracket_auth';

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (pathname.startsWith('/sports/')) {
    return true;
  }
  // Public tournament view (spectators) — manage stays protected
  if (PUBLIC_TOURNAMENT.test(pathname)) {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(AUTH_COOKIE);

  if (isPublicPath(pathname)) {
    if (hasSession && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
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
