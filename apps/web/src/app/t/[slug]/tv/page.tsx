'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import { TV_SLIDES, type TvSlide } from '@bracket/shared';
import { api } from '@/lib/api';
import type { Match, Standing, Tournament } from '@/lib/types';
import { useTournamentLive } from '@/lib/use-tournament-live';
import { SymmetricalBracket } from '@/components/symmetrical-bracket/symmetrical-bracket';
import { BracketView } from '@/components/bracket-view';
import { TournamentPasswordGate } from '@/components/tournament-password-gate';
import { shouldHideBranding, tournamentBrandStyle } from '@/components/sharing/brand-style';
import { matchLabel, sortByRoundThenTime } from '@/components/sharing/match-label';

const TREE_FORMATS = new Set(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'GROUPS_KNOCKOUT']);

type StationQueueItem = {
  station?: { id: string; name: string; status?: string } | null;
  stationName?: string;
  current?: Match | null;
  next?: Match[] | Match | null;
  queue?: Match[];
};

/** A slide is a group of standings, or a single generic slide. */
type Slide = { kind: TvSlide; title: string; groupId?: string | null };

export default function TvPage() {
  return (
    <Suspense fallback={null}>
      <TvInner />
    </Suspense>
  );
}

function TvInner() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const { data, error } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api<Tournament>(`/t/${slug}`),
    refetchInterval: 60_000,
  });
  useTournamentLive(data?.requiresPassword ? undefined : data?.id, slug);

  const stationQueue = useQuery({
    queryKey: ['station-queue', slug],
    enabled: !!data && !data.requiresPassword && (data.stations?.length ?? 0) > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      try {
        const res = await api<StationQueueItem[] | { items?: StationQueueItem[]; stations?: StationQueueItem[] }>(`/t/${slug}/station-queue`);
        return Array.isArray(res) ? res : (res.items ?? res.stations ?? []);
      } catch {
        return [] as StationQueueItem[];
      }
    },
  });

  const settings = (data?.settings ?? {}) as { tvDisplayIntervalSeconds?: number };
  const interval = Math.max(3, Number(sp.get('interval')) || settings.tvDisplayIntervalSeconds || 12);
  const slideFilter = useMemo(() => {
    const raw = sp.get('slides');
    if (!raw) return null;
    const set = new Set(raw.split(',').map((s) => s.trim()).filter((s) => (TV_SLIDES as readonly string[]).includes(s)));
    return set.size ? set : null;
  }, [sp]);

  const slides = useMemo<Slide[]>(() => {
    if (!data || data.requiresPassword) return [];
    const out: Slide[] = [];
    const want = (k: TvSlide) => !slideFilter || slideFilter.has(k);
    if (want('standings') && data.standings.length) {
      if (data.groups.length > 1) {
        for (const g of [...data.groups].sort((a, b) => a.order - b.order)) {
          if (data.standings.some((s) => s.groupId === g.id)) out.push({ kind: 'standings', title: `Standings · ${g.name}`, groupId: g.id });
        }
      } else out.push({ kind: 'standings', title: 'Standings', groupId: null });
    }
    if (want('bracket') && data.format && data.matches.length && !data.previewHidden) out.push({ kind: 'bracket', title: 'Bracket' });
    if (want('upcoming') && data.matches.some((m) => m.status !== 'COMPLETED' && !m.isBye)) out.push({ kind: 'upcoming', title: 'Up next' });
    if (want('results') && data.matches.some((m) => m.status === 'COMPLETED')) out.push({ kind: 'results', title: 'Recent results' });
    if (want('stations') && (stationQueue.data?.length ?? 0) > 0) out.push({ kind: 'stations', title: 'Stations' });
    if (!out.length) out.push({ kind: 'upcoming', title: data.status === 'DRAFT' ? 'Starting soon' : 'Matches' });
    return out;
  }, [data, slideFilter, stationQueue.data]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const go = useCallback(
    (delta: number) => {
      if (!slides.length) return;
      setIndex((i) => (i + delta + slides.length) % slides.length);
      setProgress(0);
    },
    [slides.length],
  );

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const step = 100;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + step / (interval * 1000);
        if (next >= 1) {
          setIndex((i) => (i + 1) % slides.length);
          return 0;
        }
        return next;
      });
    }, step);
    return () => clearInterval(id);
  }, [paused, interval, slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  const slide = slides[index];
  const hideBranding = shouldHideBranding(data);

  return (
    <div className="flex min-h-screen flex-col bg-[#06080c] text-white" style={tournamentBrandStyle(data)}>
      {error && <p className="p-8 text-xl text-red-400">{error instanceof Error ? error.message : 'Not found'}</p>}
      {data && (
        <TournamentPasswordGate tournament={data}>
          <header className="relative flex items-center justify-between gap-6 px-8 py-5">
            {data.backgroundImageUrl && (
              <div aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${data.backgroundImageUrl})` }} />
            )}
            <div className="flex min-w-0 items-center gap-4">
              {data.logoUrl && <img src={data.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />}
              <div className="min-w-0">
                <h1 className="font-display truncate text-3xl font-bold leading-tight md:text-4xl">{data.name}</h1>
                <p className="flex items-center gap-2 text-sm text-white/60">
                  {data.status === 'ACTIVE' && (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="relative inline-flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
                      LIVE
                    </span>
                  )}
                  {data.game?.name && <span>{data.game.name}</span>}
                  {data.format && <span>· {data.format.replaceAll('_', ' ')}</span>}
                  <span>· {data.teams.length} participants</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="font-display text-2xl font-semibold">{slide?.title}</p>
                <p className="text-xs text-white/50">{slides.length > 1 ? `${index + 1} / ${slides.length}` : ''}</p>
              </div>
              <div className="no-print flex gap-1 opacity-40 transition hover:opacity-100">
                <button type="button" onClick={() => setPaused(!paused)} className="rounded-md p-2 hover:bg-white/10" aria-label={paused ? 'Play' : 'Pause'}>
                  {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </button>
                <button type="button" onClick={toggleFullscreen} className="rounded-md p-2 hover:bg-white/10" aria-label="Fullscreen">
                  {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </header>
          <div className="h-1 w-full bg-white/10">
            <div className="h-full bg-[var(--color-accent)] transition-[width] duration-100 ease-linear" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>

          <main className="flex-1 overflow-hidden px-8 py-6">
            {slide && <SlideContent slide={slide} tournament={data} stationQueue={stationQueue.data ?? []} />}
          </main>

          <footer className="flex items-center justify-between px-8 py-3 text-xs text-white/40">
            <span>← → to switch · space to pause · F for fullscreen</span>
            <span className="flex items-center gap-4">
              {data.teams.length > 0 && <span>/t/{data.slug}</span>}
              {!hideBranding && <Link href="/" className="hover:text-white">Powered by Bracket</Link>}
            </span>
          </footer>
        </TournamentPasswordGate>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SlideContent({ slide, tournament, stationQueue }: { slide: Slide; tournament: Tournament; stationQueue: StationQueueItem[] }) {
  switch (slide.kind) {
    case 'standings':
      return <StandingsSlide tournament={tournament} groupId={slide.groupId ?? null} />;
    case 'bracket':
      return <BracketSlide tournament={tournament} />;
    case 'upcoming':
      return <MatchesSlide tournament={tournament} mode="upcoming" />;
    case 'results':
      return <MatchesSlide tournament={tournament} mode="results" />;
    case 'stations':
      return <StationsSlide items={stationQueue} tournament={tournament} />;
    default:
      return null;
  }
}

function StandingsSlide({ tournament, groupId }: { tournament: Tournament; groupId: string | null }) {
  const rows: Standing[] = tournament.standings
    .filter((s) => (groupId ? s.groupId === groupId : true))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 16);
  const showSets = rows.some((r) => (r.setsWon ?? 0) > 0);
  return (
    <table className="w-full text-left text-2xl">
      <thead className="text-sm uppercase tracking-wider text-white/50">
        <tr>
          <th className="pb-2 pr-4">#</th>
          <th className="pb-2">Team</th>
          <th className="pb-2 text-center">P</th>
          <th className="pb-2 text-center">W</th>
          <th className="pb-2 text-center">D</th>
          <th className="pb-2 text-center">L</th>
          {showSets ? <th className="pb-2 text-center">Sets</th> : <th className="pb-2 text-center">+/−</th>}
          <th className="pb-2 text-right">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => (
          <tr key={s.id} className={`border-t border-white/10 ${i < 3 ? 'text-white' : 'text-white/80'}`}>
            <td className="py-2 pr-4 font-mono text-white/60">{s.rank}</td>
            <td className="py-2">
              <span className="flex items-center gap-3">
                {s.team.logoUrl && <img src={s.team.logoUrl} alt="" className="h-9 w-9 rounded object-cover" />}
                <span className="font-semibold">{s.team.name}</span>
              </span>
            </td>
            <td className="py-2 text-center">{s.played}</td>
            <td className="py-2 text-center">{s.wins}</td>
            <td className="py-2 text-center">{s.draws}</td>
            <td className="py-2 text-center">{s.losses}</td>
            <td className="py-2 text-center font-mono">{showSets ? `${s.setsWon ?? 0}–${s.setsLost ?? 0}` : s.pointsFor - s.pointsAgainst}</td>
            <td className="py-2 text-right font-bold text-[var(--color-accent)]">{s.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BracketSlide({ tournament }: { tournament: Tournament }) {
  if (TREE_FORMATS.has(tournament.format ?? '')) {
    const t = tournament.format === 'GROUPS_KNOCKOUT' ? { ...tournament, matches: tournament.matches.filter((m) => m.bracketSide !== 'GROUP') } : tournament;
    return (
      <div className="h-full overflow-auto">
        <SymmetricalBracket tournament={t} showHeader={false} showFooter={false} />
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto text-[var(--color-ink)] [--color-ink:#fff] [--color-muted:#94a3b8] [--color-card:#11151c] [--color-line:#1f2937] [--color-surface:#0d1117]">
      <BracketView tournament={tournament} />
    </div>
  );
}

function MatchesSlide({ tournament, mode }: { tournament: Tournament; mode: 'upcoming' | 'results' }) {
  const list = useMemo(() => {
    const ms = tournament.matches.filter((m) => !m.isBye && (mode === 'upcoming' ? m.status !== 'COMPLETED' && (m.homeTeamId || m.awayTeamId) : m.status === 'COMPLETED'));
    if (mode === 'upcoming') return sortByRoundThenTime(ms).slice(0, 8);
    return [...ms].sort((a, b) => (b.reportedAt ?? '').localeCompare(a.reportedAt ?? '') || b.round - a.round).slice(0, 8);
  }, [tournament.matches, mode]);
  if (!list.length) return <p className="text-3xl text-white/50">{mode === 'upcoming' ? 'No upcoming matches.' : 'No results yet.'}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((m) => (
        <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center justify-between text-sm text-white/50">
            <span>{matchLabel(m, tournament)}</span>
            <span className="font-mono">
              {m.status === 'COMPLETED'
                ? 'Final'
                : m.scheduledAt
                  ? new Date(m.scheduledAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                  : m.status === 'READY'
                    ? 'Ready'
                    : 'TBD'}
              {(m.stationRef?.name ?? m.station) && ` · ${m.stationRef?.name ?? m.station}`}
            </span>
          </div>
          <TeamRow team={m.homeTeam} score={m.homeScore} winner={!!m.winnerTeamId && m.winnerTeamId === m.homeTeamId} done={m.status === 'COMPLETED'} />
          <TeamRow team={m.awayTeam} score={m.awayScore} winner={!!m.winnerTeamId && m.winnerTeamId === m.awayTeamId} done={m.status === 'COMPLETED'} />
        </div>
      ))}
    </div>
  );
}

function TeamRow({ team, score, winner, done }: { team?: { name: string; logoUrl?: string | null } | null; score: number | null; winner: boolean; done: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 text-2xl ${winner ? 'text-[var(--color-accent)]' : done ? 'text-white/60' : 'text-white'}`}>
      <span className="flex min-w-0 items-center gap-3">
        {team?.logoUrl && <img src={team.logoUrl} alt="" className="h-8 w-8 rounded object-cover" />}
        <span className="truncate font-semibold">{team?.name ?? 'TBD'}</span>
      </span>
      {done && <span className="font-mono text-3xl font-bold">{score ?? 0}</span>}
    </div>
  );
}

function StationsSlide({ items, tournament }: { items: StationQueueItem[]; tournament: Tournament }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((it, i) => {
        const name = it.station?.name ?? it.stationName ?? `Station ${i + 1}`;
        const current = it.current ?? null;
        const nextList = Array.isArray(it.next) ? it.next : it.next ? [it.next] : it.queue ?? [];
        return (
          <div key={it.station?.id ?? name} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="mb-2 text-sm uppercase tracking-wider text-white/50">{name}</p>
            {current ? (
              <div>
                <p className="text-xs text-emerald-400">NOW PLAYING · {matchLabel(current, tournament)}</p>
                <p className="text-2xl font-semibold">{current.homeTeam?.name ?? 'TBD'} <span className="text-white/40">vs</span> {current.awayTeam?.name ?? 'TBD'}</p>
              </div>
            ) : (
              <p className="text-xl text-white/50">Free</p>
            )}
            {nextList.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-lg text-white/70">
                {nextList.slice(0, 3).map((m) => (
                  <p key={m.id}>
                    <span className="text-xs text-white/40">NEXT · </span>
                    {m.homeTeam?.name ?? 'TBD'} vs {m.awayTeam?.name ?? 'TBD'}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
