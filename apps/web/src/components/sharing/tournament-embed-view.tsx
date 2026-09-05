'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EMBED_TABS, embedOptionsSchema, type EmbedOptions, type EmbedTab } from '@bracket/shared';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { useTournamentLive } from '@/lib/use-tournament-live';
import { SymmetricalBracket } from '@/components/symmetrical-bracket/symmetrical-bracket';
import { BracketView, StandingsTable } from '@/components/bracket-view';
import { TournamentMatchesView } from '@/components/tournament-matches-view';
import { TournamentPasswordGate } from '@/components/tournament-password-gate';
import { shouldHideBranding, tournamentBrandStyle } from './brand-style';
import { webOrigin } from './panel-kit';
import { matchLabel, sortByRoundThenTime } from './match-label';

const TREE_FORMATS = new Set(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'GROUPS_KNOCKOUT']);

const TAB_LABELS: Record<EmbedTab, string> = {
  bracket: 'Bracket',
  standings: 'Standings',
  matches: 'Matches',
  schedule: 'Schedule',
  participants: 'Participants',
};

/** Parse `?tab=&theme=&hideHeader=&showTabs=&autoRefresh=&lang=` into embed options. */
export function parseEmbedOptions(sp: URLSearchParams | null | undefined, defaults?: Partial<EmbedOptions>): EmbedOptions {
  const bool = (v: string | null) => v === '1' || v === 'true';
  const raw = {
    tab: sp?.get('tab') ?? defaults?.tab ?? 'bracket',
    theme: sp?.get('theme') ?? defaults?.theme ?? 'auto',
    lang: sp?.get('lang') ?? defaults?.lang ?? 'en',
    hideHeader: sp?.has('hideHeader') ? bool(sp.get('hideHeader')) : (defaults?.hideHeader ?? false),
    showTabs: sp?.has('showTabs') ? bool(sp.get('showTabs')) : (defaults?.showTabs ?? false),
    autoRefresh: sp?.get('autoRefresh') ? Number(sp.get('autoRefresh')) : (defaults?.autoRefresh ?? 0),
  };
  const parsed = embedOptionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : embedOptionsSchema.parse({});
}

/**
 * Iframe-friendly tournament view. Minimal chrome, theme via CSS vars,
 * optional in-frame tabs, live updates, and `postMessage({type:'bracket:resize'})`
 * so the host page can auto-size the frame (see /embed.js).
 */
export function TournamentEmbedView({ slug, options }: { slug: string; options: EmbedOptions }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api<Tournament>(`/t/${slug}`),
    refetchInterval: options.autoRefresh ? options.autoRefresh * 1000 : false,
  });
  useTournamentLive(data?.requiresPassword ? undefined : data?.id, slug);

  const settings = (data?.settings ?? {}) as { embedTheme?: string; embedDefaultTab?: string };
  const theme = options.theme !== 'auto' ? options.theme : settings.embedTheme && settings.embedTheme !== 'auto' ? settings.embedTheme : 'auto';
  const [tab, setTab] = useState<EmbedTab>(options.tab);
  useEffect(() => {
    // apply the organizer's default tab only when the URL didn't specify one
    if (options.tab === 'bracket' && settings.embedDefaultTab && (EMBED_TABS as readonly string[]).includes(settings.embedDefaultTab)) {
      setTab(settings.embedDefaultTab as EmbedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.embedDefaultTab]);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    const el = rootRef.current;
    if (!el) return;
    const post = () => {
      window.parent.postMessage({ type: 'bracket:resize', height: el.scrollHeight, slug }, '*');
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slug, tab, data]);

  const themeClass = theme === 'light' ? 'embed-light' : theme === 'dark' ? 'embed-dark' : '';
  const themeVars: Record<string, string> =
    theme === 'light'
      ? { '--color-ink': '#0f172a', '--color-muted': '#64748b', '--color-card': '#ffffff', '--color-surface': '#f1f5f9', '--color-line': '#e2e8f0', background: '#ffffff', color: '#0f172a' }
      : theme === 'dark'
        ? { '--color-ink': '#f8fafc', '--color-muted': '#94a3b8', '--color-card': '#11151c', '--color-surface': '#0d1117', '--color-line': '#1f2937', background: '#0a0c10', color: '#f8fafc' }
        : {};

  const hideBranding = shouldHideBranding(data);
  const brand = tournamentBrandStyle(data);

  return (
    <div ref={rootRef} className={`min-h-0 p-2 text-sm ${themeClass}`} style={{ ...themeVars, ...(brand as Record<string, string>) }} lang={options.lang}>
      {isLoading && <p className="p-4 text-xs text-[var(--color-muted)]">Loading…</p>}
      {error && <p className="p-4 text-xs text-red-400">{error instanceof Error ? error.message : 'Not found'}</p>}
      {data && (
        <TournamentPasswordGate tournament={data} compact onUnlocked={() => qc.invalidateQueries({ queryKey: ['tournament', slug] })}>
          {!options.hideHeader && (
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <a href={`${webOrigin()}/t/${slug}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 hover:underline">
                {data.logoUrl && <img src={data.logoUrl} alt="" className="h-6 w-6 rounded object-cover" />}
                <span className="truncate text-xs font-semibold">{data.name}</span>
                {data.status === 'ACTIVE' && <LiveDot />}
              </a>
              {!hideBranding && (
                <a href={webOrigin()} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] text-[var(--color-muted)] hover:underline">
                  Powered by Bracket
                </a>
              )}
            </div>
          )}
          {options.showTabs && (
            <div className="mb-2 flex flex-wrap gap-1 px-1">
              {EMBED_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${tab === t ? 'bg-[var(--color-accent)] text-[#041018]' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
          )}
          <EmbedTabContent tournament={data} tab={tab} theme={theme} />
          {options.hideHeader && !hideBranding && (
            <p className="mt-2 px-1 text-right text-[10px] text-[var(--color-muted)]">
              <a href={webOrigin()} target="_blank" rel="noreferrer" className="hover:underline">Powered by Bracket</a>
            </p>
          )}
        </TournamentPasswordGate>
      )}
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

export function EmbedTabContent({ tournament, tab, theme }: { tournament: Tournament; tab: EmbedTab; theme: string }) {
  if (tab === 'bracket') {
    if (tournament.previewHidden) {
      return <p className="rounded border border-dashed border-[var(--color-line)] p-4 text-xs text-[var(--color-muted)]">Bracket preview hidden</p>;
    }
    if (!tournament.format || !tournament.matches.length) {
      return <p className="p-4 text-xs text-[var(--color-muted)]">Bracket not generated yet.</p>;
    }
    if (TREE_FORMATS.has(tournament.format)) {
      const t = tournament.format === 'GROUPS_KNOCKOUT' ? { ...tournament, matches: tournament.matches.filter((m) => m.bracketSide !== 'GROUP') } : tournament;
      return (
        <div className={theme === 'light' ? 'rounded-lg bg-[#0a0c10] p-1' : ''}>
          <SymmetricalBracket tournament={t} showHeader={false} showFooter={false} />
        </div>
      );
    }
    return <div className="embed-bracket"><BracketView tournament={tournament} /></div>;
  }
  if (tab === 'standings') return <StandingsTable tournament={tournament} />;
  if (tab === 'matches') return <TournamentMatchesView tournament={tournament} />;
  if (tab === 'schedule') return <EmbedSchedule tournament={tournament} />;
  return <EmbedParticipants tournament={tournament} />;
}

function EmbedSchedule({ tournament }: { tournament: Tournament }) {
  const rows = useMemo(() => sortByRoundThenTime(tournament.matches.filter((m) => !m.isBye)), [tournament.matches]);
  if (!rows.length) return <p className="p-4 text-xs text-[var(--color-muted)]">No matches yet.</p>;
  const byDay = new Map<string, typeof rows>();
  for (const m of rows) {
    const key = m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Unscheduled';
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }
  return (
    <div className="space-y-3">
      {[...byDay.entries()].map(([day, ms]) => (
        <div key={day}>
          <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{day}</p>
          <ul className="divide-y divide-[var(--color-line)] rounded-lg border border-[var(--color-line)]">
            {ms.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="w-14 shrink-0 font-mono text-[var(--color-muted)]">
                  {m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className={m.winnerTeamId && m.winnerTeamId === m.homeTeamId ? 'font-semibold' : ''}>{m.homeTeam?.name ?? 'TBD'}</span>
                  <span className="text-[var(--color-muted)]"> vs </span>
                  <span className={m.winnerTeamId && m.winnerTeamId === m.awayTeamId ? 'font-semibold' : ''}>{m.awayTeam?.name ?? 'TBD'}</span>
                </span>
                <span className="shrink-0 font-mono">
                  {m.status === 'COMPLETED' ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}` : m.stationRef?.name ?? m.station ?? ''}
                </span>
                <span className="hidden shrink-0 text-[var(--color-muted)] sm:inline">{matchLabel(m, tournament)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EmbedParticipants({ tournament }: { tournament: Tournament }) {
  const teams = [...tournament.teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || a.name.localeCompare(b.name));
  if (!teams.length) return <p className="p-4 text-xs text-[var(--color-muted)]">No participants yet.</p>;
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((t) => (
        <li key={t.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs">
          {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-6 w-6 rounded object-cover" /> : <span className="flex h-6 w-6 items-center justify-center rounded bg-[var(--color-surface)] font-mono text-[10px] text-[var(--color-muted)]">{t.seed ?? '·'}</span>}
          <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
          {t.players?.length ? <span className="text-[10px] text-[var(--color-muted)]">{t.players.length} players</span> : null}
        </li>
      ))}
    </ul>
  );
}
