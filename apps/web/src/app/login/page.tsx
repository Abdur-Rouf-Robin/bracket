'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useActionState } from 'react';
import { loginAction, type LoginActionState } from '@/app/login/actions';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const [state, formAction, pending] = useActionState<LoginActionState, FormData>(
    loginAction,
    {},
  );

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Sign in</h1>
      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="admin@example.com"
            defaultValue="admin@example.com"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state.error && (
          <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        Demo: <code>admin@example.com</code> / <code>password123</code>
      </p>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        No account?{' '}
        <Link href="/register" className="text-[var(--color-accent)]">
          Register
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <Suspense fallback={<p className="text-[var(--color-muted)]">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
