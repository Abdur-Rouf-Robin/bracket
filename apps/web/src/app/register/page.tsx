'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email'));
    try {
      await register(String(fd.get('name')), email, String(fd.get('password')));
      setCreatedEmail(email);
      setTimeout(() => router.push('/'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-3xl font-bold">Create account</h1>
        {createdEmail ? (
          <div className="gaming-card mt-8 rounded-xl p-5 text-sm">
            <p className="font-semibold text-[var(--color-ok)]">Welcome aboard!</p>
            <p className="mt-1 text-[var(--color-muted)]">
              We sent a verification link to{' '}
              <span className="text-[var(--color-ink)]">{createdEmail}</span>. Verifying
              is optional for now, but some tournaments require it before you can sign
              up. Taking you to the home page…
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/">
                <Button>Continue</Button>
              </Link>
              <Link href="/settings/account">
                <Button variant="secondary">Account settings</Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Creating…' : 'Register'}
            </Button>
            <p className="text-xs text-[var(--color-muted)]">
              We&apos;ll email you a verification link after sign-up.
            </p>
          </form>
        )}
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--color-accent)]">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
