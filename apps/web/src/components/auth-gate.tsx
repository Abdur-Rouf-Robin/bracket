'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { isManageConsole, isPublicPath as isPublicRoute } from '@/lib/public-paths';

function isPublicPath(pathname: string) {
  return isPublicRoute(pathname) && !isManageConsole(pathname);
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
      <p className="text-sm text-[var(--color-muted)]">Loading…</p>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublic) {
      const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
      router.replace(`/login${next}`);
      return;
    }

    if (user && (pathname === '/login' || pathname === '/register')) {
      router.replace('/');
    }
  }, [loading, user, isPublic, pathname, router]);

  if (loading && !user && !isPublic) {
    return <LoadingScreen />;
  }

  if (!loading && !user && !isPublic) {
    return <LoadingScreen />;
  }

  return children;
}
