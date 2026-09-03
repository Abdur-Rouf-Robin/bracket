/** Sentry is a no-op unless NEXT_PUBLIC_SENTRY_DSN is set. */
export function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  // Dynamic import keeps bundle clean when unused
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  });
}
