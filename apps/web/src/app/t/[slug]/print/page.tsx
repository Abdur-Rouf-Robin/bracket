'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileDown, Printer } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { SymmetricalBracket } from '@/components/symmetrical-bracket/symmetrical-bracket';
import { BracketView, StandingsTable } from '@/components/bracket-view';
import { TournamentPasswordGate } from '@/components/tournament-password-gate';
import { shouldHideBranding } from '@/components/sharing/brand-style';
import { matchLabel, sortByRoundThenTime } from '@/components/sharing/match-label';
import { Button } from '@/components/ui/button';

const SECTIONS = ['bracket', 'standings', 'matches', 'participants', 'schedule'] as const;
type Section = (typeof SECTIONS)[number];
const LABELS: Record<Section, string> = { bracket: 'Bracket', standings: 'Standings', matches: 'Matches & results', participants: 'Participants', schedule: 'Schedule' };
const TREE_FORMATS = new Set(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'GROUPS_KNOCKOUT']);

const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; color: #111 !important; }
  .print-root { color: #111; --color-ink: #111; --color-muted: #555; --color-card: #fff; --color-surface: #f5f5f5; --color-line: #ccc; --color-accent: #111; }
  .print-section { break-inside: avoid; page-break-inside: avoid; }
  .print-page-break { break-before: page; page-break-before: always; }
  a { color: inherit; text-decoration: none; }
}
.print-root table { width: 100%; border-collapse: collapse; font-size: 12px; }
.print-root th, .print-root td { border-bottom: 1px solid var(--color-line); padding: 4px 6px; text-align: left; }
`;

export default function PrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintInner />
    </Suspense>
  );
}

function PrintInner() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api<Tournament>(`/t/${slug}`),
  });

  const selected = useMemo((): Section[] => {
    const raw = sp.get('sections');
    if (!raw) return ['bracket', 'standings', 'matches'];
    const list = raw
      .split(',')
      .filter((s): s is Section => (SECTIONS as readonly Section[]).includes(s as Section));
    return list.length ? list : ['bracket'];
  }, [sp]);
  const [light, setLight] = useState(true);

  function toggle(s: Section) {
    const next = selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s];
    router.replace(`/t/${slug}/print?sections=${next.join(',')}`);
  }

  const hideBranding = shouldHideBranding(data);

  return (
    <div className={`print-root min-h-screen ${light ? 'bg-white text-[#111] [--color-ink:#111] [--color-muted:#555] [--color-card:#fff] [--color-surface:#f5f5f5] [--color-line:#ddd]' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <header className="no-print sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-card)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link href={`/t/${slug}`} className="text-xs text-[var(--color-accent)] hover:underline">← Back to tournament</Link>
            <h1 className="font-display text-lg font-bold">Print · {data?.name ?? ''}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SECTIONS.map((s) => (
              <button key={s} type="button" onClick={() => toggle(s)} className={`choice-btn rounded-md border px-2.5 py-1 text-xs ${selected.includes(s) ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 font-semibold' : 'border-[var(--color-line)]'}`}>
                {LABELS[s]}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-1 text-xs"><input type="checkbox" checked={light} onChange={(e) => setLight(e.target.checked)} /> Light</label>
            <a href={`${API_URL}/t/${slug}/export/bracket.pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold"><FileDown className="h-3.5 w-3.5" /> PDF</a>
            <Button type="button" onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" /> Print</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6">
        {isLoading && <p className="text-[var(--color-muted)]">Loading…</p>}
        {error && <p className="text-red-500">{error instanceof Error ? error.message : 'Not found'}</p>}
        {data && (
          <TournamentPasswordGate tournament={data}>
            <div className="print-section mb-6 flex items-center gap-4 border-b border-[var(--color-line)] pb-4">
              {data.logoUrl && <img src={data.logoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <div>
                <h2 className="font-display text-3xl font-bold">{data.name}</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  {[data.game?.name, data.format?.replaceAll('_', ' '), data.startAt ? new Date(data.startAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : null, data.venueName, `${data.teams.length} participants`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {selected.map((s, i) => (
              <section key={s} className={`print-section mb-8 ${i > 0 ? 'print-page-break' : ''}`}>
                <h3 className="font-display mb-3 text-xl font-bold">{LABELS[s]}</h3>
                <PrintSection section={s} tournament={data} light={light} />
              </section>
            ))}
            {!hideBranding && (
              <p className="mt-10 text-center text-[10px] text-[var(--color-muted)]">Generated by Bracket · {typeof window !== 'undefined' ? `${window.location.origin}/t/${data.slug}` : `/t/${data.slug}`}</p>
            )}
          </TournamentPasswordGate>
        )}
      </main>
    </div>
  );
}

function PrintSection({ section, tournament, light }: { section: Section; tournament: Tournament; light: boolean }) {
  switch (section) {
    case 'bracket': {
      if (tournament.previewHidden) return <p className="text-sm text-[var(--color-muted)]">Bracket preview is hidden.</p>;
      if (!tournament.format || !tournament.matches.length) return <p className="text-sm text-[var(--color-muted)]">Bracket not generated yet.</p>;
      if (TREE_FORMATS.has(tournament.format)) {
        const t = tournament.format === 'GROUPS_KNOCKOUT' ? { ...tournament, matches: tournament.matches.filter((m) => m.bracketSide !== 'GROUP') } : tournament;
        return (
          <div className={light ? 'overflow-hidden rounded-lg bg-[#0a0c10] p-2' : ''}>
            <SymmetricalBracket tournament={t} showHeader={false} showFooter={false} />
          </div>
        );
      }
      return <BracketView tournament={tournament} />;
    }
    case 'standings':
      return <StandingsTable tournament={tournament} />;
    case 'matches':
      return <MatchesTable tournament={tournament} />;
    case 'participants':
      return <ParticipantsTable tournament={tournament} />;
    case 'schedule':
      return <ScheduleTable tournament={tournament} />;
    default:
      return null;
  }
}

function MatchesTable({ tournament }: { tournament: Tournament }) {
  const rows = tournament.matches.filter((m) => !m.isBye).sort((a, b) => a.bracketSide.localeCompare(b.bracketSide) || a.round - b.round || a.position - b.position);
  if (!rows.length) return <p className="text-sm text-[var(--color-muted)]">No matches yet.</p>;
  return (
    <table>
      <thead><tr><th>Stage</th><th>Home</th><th>Score</th><th>Away</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <td className="text-[var(--color-muted)]">{matchLabel(m, tournament)}</td>
            <td className={m.winnerTeamId && m.winnerTeamId === m.homeTeamId ? 'font-semibold' : ''}>{m.homeTeam?.name ?? 'TBD'}</td>
            <td className="font-mono">{m.status === 'COMPLETED' ? `${m.homeScore ?? 0} – ${m.awayScore ?? 0}` : '–'}</td>
            <td className={m.winnerTeamId && m.winnerTeamId === m.awayTeamId ? 'font-semibold' : ''}>{m.awayTeam?.name ?? 'TBD'}</td>
            <td className="text-[var(--color-muted)]">{m.status === 'COMPLETED' ? (m.isDraw ? 'Draw' : m.isForfeit ? 'Forfeit' : 'Final') : m.status.toLowerCase()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParticipantsTable({ tournament }: { tournament: Tournament }) {
  const teams = [...tournament.teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || a.name.localeCompare(b.name));
  return (
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Group</th><th>Players</th></tr></thead>
      <tbody>
        {teams.map((t, i) => (
          <tr key={t.id}>
            <td className="font-mono text-[var(--color-muted)]">{t.seed ?? i + 1}</td>
            <td className="font-semibold">{t.name}</td>
            <td>{tournament.groups.find((g) => g.id === t.groupId)?.name ?? ''}</td>
            <td className="text-[var(--color-muted)]">{(t.players ?? []).map((p) => p.name).join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScheduleTable({ tournament }: { tournament: Tournament }) {
  const rows = sortByRoundThenTime(tournament.matches.filter((m) => !m.isBye && m.scheduledAt));
  if (!rows.length) return <p className="text-sm text-[var(--color-muted)]">No scheduled matches.</p>;
  return (
    <table>
      <thead><tr><th>Date</th><th>Time</th><th>Station</th><th>Match</th><th>Stage</th></tr></thead>
      <tbody>
        {rows.map((m) => {
          const d = new Date(m.scheduledAt!);
          return (
            <tr key={m.id}>
              <td>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
              <td className="font-mono">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
              <td>{m.stationRef?.name ?? m.station ?? ''}</td>
              <td>{m.homeTeam?.name ?? 'TBD'} vs {m.awayTeam?.name ?? 'TBD'}</td>
              <td className="text-[var(--color-muted)]">{matchLabel(m, tournament)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
