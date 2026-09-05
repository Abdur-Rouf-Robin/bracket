'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { CheckCircle2, MailWarning, LoaderCircle } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type State =
  | { kind: 'idle' }
  | { kind: 'verifying' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, token: authToken, refreshUser } = useAuth();
  const [state, setState] = useState<State>({ kind: token ? 'verifying' : 'idle' });
  const [resendMsg, setResendMsg] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void (async () => {
      try {
        await api('/account/verification/confirm', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        setState({ kind: 'ok' });
        await refreshUser();
      } catch (err) {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Verification failed',
        });
      }
    })();
  }, [token, refreshUser]);

  async function resend() {
    setResendMsg('');
    try {
      await api('/account/verification/send', { method: 'POST', token: authToken });
      setResendMsg('A new verification email is on its way.');
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : 'Could not send email');
    }
  }

  return (
    <div className="gaming-card rounded-2xl p-8 text-center">
      {state.kind === 'verifying' && (
        <>
          <LoaderCircle className="mx-auto size-10 animate-spin text-[var(--color-accent)]" />
          <h1 className="font-display mt-4 text-2xl font-bold">Verifying your email…</h1>
        </>
      )}
      {state.kind === 'ok' && (
        <>
          <CheckCircle2 className="mx-auto size-12 text-[var(--color-ok)]" />
          <h1 className="font-display mt-4 text-2xl font-bold">Email verified</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Thanks{user ? `, ${user.name}` : ''}. You can now sign up for tournaments that
            require a verified email.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={user ? '/dashboard' : '/login'}>
              <Button>{user ? 'Go to dashboard' : 'Sign in'}</Button>
            </Link>
            <Link href="/browse">
              <Button variant="secondary">Browse tournaments</Button>
            </Link>
          </div>
        </>
      )}
      {(state.kind === 'error' || state.kind === 'idle') && (
        <>
          <MailWarning className="mx-auto size-12 text-[var(--color-danger)]" />
          <h1 className="font-display mt-4 text-2xl font-bold">
            {state.kind === 'idle' ? 'Missing verification link' : 'Verification failed'}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {state.kind === 'error'
              ? state.message
              : 'Open the link from your verification email, or request a new one below.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {user && authToken ? (
              <Button onClick={resend}>Resend verification email</Button>
            ) : (
              <Link href="/login?next=/settings/account">
                <Button>Sign in to resend</Button>
              </Link>
            )}
            <Link href="/">
              <Button variant="secondary">Home</Button>
            </Link>
          </div>
          {resendMsg && (
            <p className="mt-3 text-xs text-[var(--color-muted)]">{resendMsg}</p>
          )}
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <Suspense
          fallback={<p className="text-[var(--color-muted)]">Loading…</p>}
        >
          <VerifyEmailContent />
        </Suspense>
      </main>
    </div>
  );
}
