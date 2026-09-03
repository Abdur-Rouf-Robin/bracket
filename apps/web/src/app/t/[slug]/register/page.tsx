'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import { rosterLimits } from '@bracket/shared';

export default function TournamentRegisterPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [teamName, setTeamName] = useState('');
  const [players, setPlayers] = useState<string[]>(['']);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () =>
      api<Tournament>(`/t/${slug}`, { token: token ?? undefined }),
  });

  const settings = data?.settings as
    | {
        registrationMode?: string;
        maxParticipants?: number;
        playersPerTeam?: number;
        substituteSlots?: number;
        allowSubstitutes?: boolean;
        requireTeamRegistration?: boolean;
      }
    | undefined;

  const limits = rosterLimits({
    playersPerTeam: settings?.playersPerTeam ?? 1,
    substituteSlots: settings?.substituteSlots ?? 0,
    allowSubstitutes: settings?.allowSubstitutes ?? false,
    requireTeamRegistration: settings?.requireTeamRegistration ?? false,
  });
  const playersPerTeam = limits.starters;
  const openSignup = settings?.registrationMode === 'OPEN_SIGNUP';
  const requirePlayers =
    settings?.requireTeamRegistration === true || playersPerTeam > 1;

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(`/t/${slug}/register`)}`);
    }
  }, [loading, user, router, slug]);

  useEffect(() => {
    if (requirePlayers && players.length < playersPerTeam) {
      setPlayers((prev) => {
        const next = [...prev];
        while (next.length < playersPerTeam) next.push('');
        return next;
      });
    }
  }, [requirePlayers, playersPerTeam]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Sign in required');
      return api(`/t/${slug}/register`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          teamName,
          players: players.filter((p) => p.trim()),
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournament', slug] });
      router.push(`/t/${slug}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-8 text-[var(--color-muted)]">Loading…</p>
      </div>
    );
  }

  const spotsLeft =
    settings?.maxParticipants != null
      ? Math.max(0, settings.maxParticipants - (data?.teams.length ?? 0))
      : null;

  const registrationClosed =
    !data ||
    data.status === 'COMPLETED' ||
    (data.matches?.length ?? 0) > 0 ||
    spotsLeft === 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-10">
        <Link
          href={`/t/${slug}`}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          ← Back to {data?.name ?? 'tournament'}
        </Link>

        <h1 className="font-display mt-4 text-3xl font-bold">Register</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Join {data?.name ?? 'this tournament'} as a participant.
        </p>

        {isLoading && (
          <p className="mt-6 text-[var(--color-muted)]">Loading…</p>
        )}

        {data && !openSignup && (
          <p className="mt-6 rounded-lg border border-dashed border-[var(--color-line)] p-4 text-[var(--color-muted)]">
            This tournament uses a host-managed participant list. Contact the
            organizer to join.
          </p>
        )}

        {data && openSignup && registrationClosed && (
          <p className="mt-6 rounded-lg border border-dashed border-[var(--color-line)] p-4 text-[var(--color-muted)]">
            Registration is closed
            {data.status === 'COMPLETED'
              ? ' — tournament completed.'
              : (data.matches?.length ?? 0) > 0
                ? ' — bracket already generated.'
                : spotsLeft === 0
                  ? ' — tournament is full.'
                  : '.'}
          </p>
        )}

        {data && openSignup && !registrationClosed && (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              mutation.mutate();
            }}
          >
            {spotsLeft != null && (
              <p className="text-sm text-[var(--color-muted)]">
                {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} remaining
              </p>
            )}

            <div>
              <Label htmlFor="teamName">
                {playersPerTeam > 1 ? 'Team name' : 'Display name'}
              </Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                maxLength={80}
                placeholder={user.name}
              />
            </div>

            {(requirePlayers || players.length > 0) &&
              players.map((name, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`player-${i}`}>
                      Player {i + 1}
                      {i === 0 ? ' (captain)' : ''}
                    </Label>
                    <Input
                      id={`player-${i}`}
                      value={name}
                      onChange={(e) => {
                        const next = [...players];
                        next[i] = e.target.value;
                        setPlayers(next);
                      }}
                      required={
                        settings?.requireTeamRegistration === true &&
                        i < playersPerTeam
                      }
                      maxLength={80}
                      placeholder={i === 0 ? user.name : ''}
                    />
                  </div>
                  {(!requirePlayers || players.length > limits.maxRoster) && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-6 shrink-0 text-red-600"
                      onClick={() =>
                        setPlayers((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}

            <Button
              type="button"
              variant="ghost"
              className="h-8 text-xs"
              disabled={players.filter((p) => p.trim()).length >= limits.maxRoster}
              onClick={() => setPlayers((prev) => [...prev, ''])}
            >
              + Add player
              {settings?.allowSubstitutes
                ? ` (max ${limits.maxRoster}: ${limits.starters} starters + ${limits.substituteSlots} subs)`
                : ''}
            </Button>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <Button type="submit" disabled={mutation.isPending || !teamName.trim()}>
              {mutation.isPending ? 'Registering…' : 'Register'}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
