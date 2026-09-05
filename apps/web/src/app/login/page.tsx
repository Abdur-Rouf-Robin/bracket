'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';

function LoginForm({ next }: { next: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const destination = next.startsWith('/') ? next : '/';
    try {
      await login(String(fd.get('email') ?? '').trim(), String(fd.get('password') ?? ''));
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="mb-1 text-xs text-[var(--color-accent)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        No account?{' '}
        <Link href="/register" className="text-[var(--color-accent)]">
          Register
        </Link>
      </p>
    </>
  );
}

function LoginFormFromQuery() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  return <LoginForm next={next} />;
}

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <Suspense fallback={<LoginForm next="/" />}>
          <LoginFormFromQuery />
        </Suspense>
      </main>
    </div>
  );
}
