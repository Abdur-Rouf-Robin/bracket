'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { setViewToken } from '@/lib/view-token';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type LockedTournament = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  requiresPassword?: boolean;
  isPublic?: boolean;
  status?: string;
};

/**
 * Wrap public tournament pages: when the API returns `{ requiresPassword: true }`
 * (spectator password enabled and no valid `x-view-token`), render a lock
 * screen. On unlock the token is stored per-slug and the `['tournament', slug]`
 * query is invalidated so the wrapped page re-renders with full data.
 *
 * Usage (public page owned by the tournament page workstream):
 *   <TournamentPasswordGate tournament={data}>{...page...}</TournamentPasswordGate>
 */
export function TournamentPasswordGate({
  tournament,
  children,
  compact = false,
  onUnlocked,
}: {
  tournament: LockedTournament | null | undefined;
  children: ReactNode;
  /** Smaller layout for embeds / TV. */
  compact?: boolean;
  onUnlocked?: () => void;
}) {
  if (tournament?.requiresPassword) {
    return (
      <PasswordLockScreen tournament={tournament} compact={compact} onUnlocked={onUnlocked} />
    );
  }
  return <>{children}</>;
}

export function PasswordLockScreen({
  tournament,
  compact = false,
  onUnlocked,
}: {
  tournament: LockedTournament;
  compact?: boolean;
  onUnlocked?: () => void;
}) {
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ viewToken: string }>(`/t/${tournament.slug}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ password }),
        viewToken: null,
      });
      setViewToken(tournament.slug, res.viewToken);
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
      await qc.invalidateQueries({ queryKey: ['tournament-id', tournament.id] });
      onUnlocked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        compact
          ? 'flex min-h-[240px] items-center justify-center p-4'
          : 'relative flex min-h-[70vh] items-center justify-center px-6 py-16'
      }
    >
      {!compact && tournament.backgroundImageUrl && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-20 blur-sm"
          style={{ backgroundImage: `url(${tournament.backgroundImageUrl})` }}
        />
      )}
      <form
        onSubmit={submit}
        className="gaming-card w-full max-w-md space-y-5 rounded-2xl p-6 text-center sm:p-8"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
          {tournament.logoUrl ? (
            <img src={tournament.logoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <Lock className="h-6 w-6" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
            Password protected
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold">{tournament.name}</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            The organizer has restricted this tournament to people with the
            spectator password.
          </p>
        </div>
        <div className="space-y-2 text-left">
          <Input
            type="password"
            autoFocus
            autoComplete="off"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={busy || !password.trim()}>
          {busy ? 'Unlocking…' : 'Unlock tournament'}
        </Button>
      </form>
    </div>
  );
}
