'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { REALTIME_EVENTS, type TournamentSettings } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import { io, type Socket } from 'socket.io-client';

type DrawStep = {
  index: number;
  teamId: string;
  teamName: string;
  groupId: string;
  groupName: string;
};

export default function DrawCeremonyPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { token } = useAuth();
  const [steps, setSteps] = useState<DrawStep[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const { data: tournament } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api<Tournament>(`/t/${slug}`, { token: token ?? undefined }),
  });

  const settings = (tournament?.settings ?? {}) as TournamentSettings;

  useEffect(() => {
    if (!tournament?.id) return;
    const socket: Socket = io(
      process.env.NEXT_PUBLIC_WS_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        'http://localhost:3001',
      { transports: ['websocket'] },
    );
    socket.emit('tournament:join', { tournamentId: tournament.id });
    socket.on(REALTIME_EVENTS.DRAW_STEP, (payload: { step: DrawStep }) => {
      setSteps((prev) => [...prev, payload.step]);
    });
    socket.on(REALTIME_EVENTS.DRAW_COMPLETE, () => {
      setDone(true);
      setRunning(false);
    });
    return () => {
      socket.emit('tournament:leave', { tournamentId: tournament.id });
      socket.disconnect();
    };
  }, [tournament?.id]);

  async function startCeremony() {
    if (!tournament || !token) return;
    setRunning(true);
    setSteps([]);
    setDone(false);
    const groupCount = tournament.groups.length || 4;
    await api(`/tournaments/${tournament.id}/draw/ceremony`, {
      method: 'POST',
      token,
      body: JSON.stringify({ groupCount, mode: settings.groupDrawMode }),
    });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={`/t/${slug}`}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          ← Back to tournament
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold">Live draw ceremony</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          {tournament?.name ?? 'Loading…'} — watch teams assigned to groups in real time.
        </p>

        {tournament?.canManage && (
          <Button
            className="mt-6"
            disabled={running}
            onClick={() => void startCeremony()}
          >
            {running ? 'Drawing…' : 'Start live draw'}
          </Button>
        )}

        <div className="mt-8 space-y-2">
          {steps.map((step) => (
            <div
              key={`${step.teamId}-${step.index}`}
              className="animate-in fade-in slide-in-from-bottom-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3"
            >
              <p className="font-semibold">{step.teamName}</p>
              <p className="text-sm text-[var(--color-muted)]">→ {step.groupName}</p>
            </div>
          ))}
          {done && (
            <p className="pt-4 text-center text-sm font-semibold text-[var(--color-ok)]">
              Draw complete
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
