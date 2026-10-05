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
  '/games',
  '/circuits',
  '/api-docs',
  '/embed',
];

const PUBLIC_PREFIXES = [
  '/sports/',
  '/c/',
  '/e/',
  '/u/',
  '/p/',
  '/r/',
  '/formats/',
  '/help/',
];

const PUBLIC_TOURNAMENT =
  /^\/t\/[^/]+(\/bracket|\/mvp|\/embed|\/register|\/draw|\/schedule|\/standings|\/tv|\/print|\/qr|\/results|\/participants|\/scoreboard\/[^/]+|\/m\/[^/]+)?$/;

export function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return true;
  }
  if (PUBLIC_TOURNAMENT.test(pathname)) {
    return true;
  }
  return false;
}

export function isManageConsole(pathname: string) {
  return /^\/(c|e)\/[^/]+\/manage(\/|$)/.test(pathname);
}
