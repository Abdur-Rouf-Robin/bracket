'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download, Facebook, Mail, MessageCircle, Send, Share2, Trophy } from 'lucide-react';
import { socialShareLinks } from '@bracket/shared';
import { api, API_URL } from '@/lib/api';
import type { Team, Tournament } from '@/lib/types';
import { useTournamentLive } from '@/lib/use-tournament-live';
import { SiteHeader } from '@/components/site-header';
import { TournamentPasswordGate } from '@/components/tournament-password-gate';
import { TournamentBrandStyle } from '@/components/sharing/brand-style';
import { CopyButton, webOrigin } from '@/components/sharing/panel-kit';
import { findChampion } from '@/components/symmetrical-bracket/use-bracket-layout';

type Placement = { rank: number; team: Team; detail?: string };

export default function ResultsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api<Tournament>(`/t/${slug}`),
  });
  useTournamentLive(data?.requiresPassword ? undefined : data?.id, slug);

  const placements = useMemo(() => (data && !data.requiresPassword ? computePlacements(data) : []), [data]);
  const completed = data?.status === 'COMPLETED';
  const url = `${webOrigin()}/t/${slug}/results`;
  const share = socialShareLinks(url, data ? `${data.name} — final results${placements[0] ? `: ${placements[0].team.name} wins!` : ''}` : 'Tournament results');

  const total = data?.matches.filter((m) => !m.isBye).length ?? 0;
  const done = data?.matches.filter((m) => !m.isBye && m.status === 'COMPLETED').length ?? 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <TournamentBrandStyle tournament={data} as="main" className="mx-auto max-w-5xl px-6 py-10">
        {isLoading && <p className="text-[var(--color-muted)]">Loading…</p>}
        {error && <p className="text-red-500">{error instanceof Error ? error.message : 'Not found'}</p>}
        {data && (
          <TournamentPasswordGate tournament={data}>
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href={`/t/${slug}`} className="text-xs text-[var(--color-accent)] hover:underline">← {data.name}</Link>
                <h1 className="font-display mt-1 text-4xl font-bold">{completed ? 'Final results' : 'Results'}</h1>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {data.game?.name ? `${data.game.name} · ` : ''}{data.format?.replaceAll('_', ' ')} · {data.teams.length} participants
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`${API_URL}/t/${slug}/export/standings.pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-[#041018]">
                  <Download className="h-3.5 w-3.5" /> Results PDF
                </a>
                <CopyButton value={url} label="Copy link" />
              </div>
            </div>

            {!completed && (
              <div className="gaming-card mb-8 rounded-2xl p-5">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold">Tournament in progress</p>
                  <p className="text-[var(--color-muted)]">{done} / {total} matches played</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-line)]">
                  <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">Final placements appear here once the organizer completes the tournament. Live standings below.</p>
              </div>
            )}

            {placements.length > 0 && (
              <>
                {completed && placements[0] && <ChampionCard team={placements[0].team} tournament={data} />}
                <Podium placements={placements} muted={!completed} />
              </>
            )}

            {placements.length > 0 ? (
              <section className="gaming-card mt-8 overflow-hidden rounded-2xl">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-surface)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    <tr><th className="px-4 py-2">Place</th><th className="px-4 py-2">Participant</th><th className="px-4 py-2 text-right">Record</th></tr>
                  </thead>
                  <tbody>
                    {placements.map((p) => (
                      <tr key={p.team.id} className="border-t border-[var(--color-line)]">
                        <td className="px-4 py-2 font-mono">{ordinal(p.rank)}</td>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2">
                            {p.team.logoUrl && <img src={p.team.logoUrl} alt="" className="h-6 w-6 rounded object-cover" />}
                            <span className="font-medium">{p.team.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-[var(--color-muted)]">{p.detail ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-muted)]">No results yet.</p>
            )}

            <section className="mt-8 flex flex-wrap items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-[var(--color-muted)]"><Share2 className="h-4 w-4" /> Share</span>
              <ShareBtn href={share.x} label="X" />
              <ShareBtn href={share.facebook} label="Facebook" icon={<Facebook className="h-3.5 w-3.5" />} />
              <ShareBtn href={share.whatsapp} label="WhatsApp" icon={<MessageCircle className="h-3.5 w-3.5" />} />
              <ShareBtn href={share.telegram} label="Telegram" icon={<Send className="h-3.5 w-3.5" />} />
              <ShareBtn href={share.email} label="Email" icon={<Mail className="h-3.5 w-3.5" />} />
            </section>
          </TournamentPasswordGate>
        )}
      </TournamentBrandStyle>
    </div>
  );
}

function ShareBtn({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-accent)]/50">
      {icon}{label}
    </a>
  );
}

function ChampionCard({ team, tournament }: { team: Team; tournament: Tournament }) {
  return (
    <div className="gaming-card relative mb-6 overflow-hidden rounded-2xl p-8 text-center">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,var(--color-accent)_0%,transparent_60%)] opacity-20" />
      <Trophy className="mx-auto h-10 w-10 text-amber-400" />
      <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[var(--color-muted)]">Champion</p>
      <div className="mt-2 flex items-center justify-center gap-3">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />}
        <h2 className="font-display text-4xl font-bold">{team.name}</h2>
      </div>
      {team.players?.length ? <p className="mt-2 text-sm text-[var(--color-muted)]">{team.players.map((p) => p.name).join(' · ')}</p> : null}
      <p className="mt-3 text-sm text-[var(--color-muted)]">{tournament.name}</p>
    </div>
  );
}

function Podium({ placements, muted }: { placements: Placement[]; muted: boolean }) {
  const first = placements.find((p) => p.rank === 1);
  const second = placements.find((p) => p.rank === 2);
  const third = placements.find((p) => p.rank === 3);
  if (!first) return null;
  const Step = ({ p, height, color }: { p?: Placement; height: string; color: string }) =>
    p ? (
      <div className="flex flex-1 flex-col items-center justify-end">
        {p.team.logoUrl && <img src={p.team.logoUrl} alt="" className="mb-2 h-10 w-10 rounded-lg object-cover" />}
        <p className="mb-2 max-w-[10rem] truncate text-center text-sm font-semibold">{p.team.name}</p>
        <div className={`flex w-full items-start justify-center rounded-t-xl ${height} ${color} ${muted ? 'opacity-60' : ''}`}>
          <span className="mt-2 font-display text-2xl font-bold text-[#041018]">{p.rank}</span>
        </div>
      </div>
    ) : <div className="flex-1" />;
  return (
    <div className="flex items-end gap-3 px-4">
      <Step p={second} height="h-24" color="bg-slate-300" />
      <Step p={first} height="h-36" color="bg-amber-400" />
      <Step p={third} height="h-16" color="bg-orange-300" />
    </div>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Placements from standings ranks; for knockout formats derive from bracket progress. */
function computePlacements(t: Tournament): Placement[] {
  const isKnockout = t.format === 'SINGLE_ELIMINATION' || t.format === 'DOUBLE_ELIMINATION' || t.format === 'GROUPS_KNOCKOUT';
  const recordOf = (teamId: string) => {
    const s = t.standings.find((x) => x.teamId === teamId);
    return s ? `${s.wins}W–${s.losses}L${s.draws ? `–${s.draws}D` : ''}` : undefined;
  };

  if (isKnockout && t.matches.length) {
    const ko = t.matches.filter((m) => m.bracketSide !== 'GROUP');
    const out: Placement[] = [];
    const used = new Set<string>();
    const push = (rank: number, teamId: string | null | undefined) => {
      if (!teamId || used.has(teamId)) return;
      const team = t.teams.find((x) => x.id === teamId);
      if (!team) return;
      used.add(teamId);
      out.push({ rank, team, detail: recordOf(teamId) });
    };
    const champ = findChampion(ko, t.teams);
    push(1, champ?.id);
    const finals = ko.filter((m) => (m.bracketSide === 'GRAND_FINAL' || m.bracketSide === 'FINAL' || (m.bracketSide === 'WINNERS' && m.round === Math.max(...ko.filter((x) => x.bracketSide === 'WINNERS').map((x) => x.round)))) && !m.isPlacement && m.status === 'COMPLETED');
    for (const f of finals.sort((a, b) => b.round - a.round)) {
      const loser = f.winnerTeamId === f.homeTeamId ? f.awayTeamId : f.homeTeamId;
      push(2, loser);
    }
    const placement = ko.filter((m) => m.isPlacement || m.key.includes('3rd') || m.key.includes('-pl-')).filter((m) => m.status === 'COMPLETED');
    for (const m of placement.sort((a, b) => (a.placementRank ?? 3) - (b.placementRank ?? 3))) {
      const rank = m.placementRank ?? 3;
      push(rank, m.winnerTeamId);
      push(rank + 1, m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId);
    }
    // remaining by standings rank (when the engine stores knockout standings) or elimination round
    const rest = t.teams.filter((x) => !used.has(x.id));
    const elimRound = (teamId: string) => {
      const played = ko.filter((m) => m.status === 'COMPLETED' && (m.homeTeamId === teamId || m.awayTeamId === teamId));
      return played.reduce((max, m) => Math.max(max, m.round), 0);
    };
    rest.sort((a, b) => {
      const sa = t.standings.find((x) => x.teamId === a.id)?.rank ?? 999;
      const sb = t.standings.find((x) => x.teamId === b.id)?.rank ?? 999;
      if (sa !== sb) return sa - sb;
      return elimRound(b.id) - elimRound(a.id);
    });
    let rank = out.length ? Math.max(...out.map((p) => p.rank)) + 1 : 1;
    for (const team of rest) out.push({ rank: rank++, team, detail: recordOf(team.id) });
    return out.sort((a, b) => a.rank - b.rank);
  }

  if (t.standings.length) {
    const grouped = t.groups.length > 1;
    return [...t.standings]
      .sort((a, b) => (grouped ? a.rank - b.rank || b.points - a.points : a.rank - b.rank))
      .map((s, i) => ({ rank: grouped ? i + 1 : s.rank, team: s.team, detail: `${s.points} pts · ${s.wins}W–${s.losses}L${s.draws ? `–${s.draws}D` : ''}` }));
  }
  return [];
}
