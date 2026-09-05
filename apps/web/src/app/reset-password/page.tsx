'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setPending(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setTimeout(() => router.replace('/login'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="gaming-card rounded-xl p-5 text-sm">
        <p className="font-semibold">This reset link is incomplete.</p>
        <p className="mt-1 text-[var(--color-muted)]">
          Request a new one from the{' '}
          <Link href="/forgot-password" className="text-[var(--color-accent)]">
            forgot password
          </Link>{' '}
          page.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="gaming-card rounded-xl p-5 text-sm">
        <p className="font-semibold text-[var(--color-ok)]">Password updated</p>
        <p className="mt-1 text-[var(--color-muted)]">
          Redirecting you to sign in…{' '}
          <Link href="/login" className="text-[var(--color-accent)]">
            Go now
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-3xl font-bold">Choose a new password</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Use at least 8 characters. You&apos;ll be signed out of other sessions.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-[var(--color-muted)]">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
