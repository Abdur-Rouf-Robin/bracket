'use client';

import { useMemo } from 'react';
import {
  computePlayerMvpScore,
  mvpWeightsSchema,
  resolveMatchMvp,
  type PlayerMatchStatsInput,
} from '@bracket/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Team, TeamPlayer } from '@/lib/types';

export type PlayerStatDraft = {
  goals: string;
  assists: string;
  points: string;
  kills: string;
  deaths: string;
  yellowCards: string;
  redCards: string;
  rating: string;
};

export function emptyStatDraft(): PlayerStatDraft {
  return {
    goals: '',
    assists: '',
    points: '',
    kills: '',
    deaths: '',
    yellowCards: '',
    redCards: '',
    rating: '',
  };
}

export function draftsFromMatchStats(
  players: TeamPlayer[],
  existing?: Array<{
    playerId: string;
    goals: number;
    assists: number;
    points: number;
    kills: number;
    deaths: number;
    rating: number | null;
  }>,
): Record<string, PlayerStatDraft> {
  const map: Record<string, PlayerStatDraft> = {};
  for (const p of players) {
    const row = existing?.find((s) => s.playerId === p.id);
    map[p.id] = row
      ? {
          goals: String(row.goals || ''),
          assists: String(row.assists || ''),
          points: String(row.points || ''),
          kills: String(row.kills || ''),
          deaths: String(row.deaths || ''),
          yellowCards: String((row as { yellowCards?: number }).yellowCards || ''),
          redCards: String((row as { redCards?: number }).redCards || ''),
          rating: row.rating != null ? String(row.rating) : '',
        }
      : emptyStatDraft();
  }
  return map;
}

export function draftsToPayload(
  drafts: Record<string, PlayerStatDraft>,
  players: TeamPlayer[],
): PlayerMatchStatsInput[] {
  return players.map((p) => {
    const d = drafts[p.id] ?? emptyStatDraft();
    return {
      playerId: p.id,
      teamId: p.teamId ?? '',
      goals: d.goals === '' ? 0 : Number(d.goals),
      assists: d.assists === '' ? 0 : Number(d.assists),
      points: d.points === '' ? 0 : Number(d.points),
      kills: d.kills === '' ? 0 : Number(d.kills),
      deaths: d.deaths === '' ? 0 : Number(d.deaths),
      yellowCards: d.yellowCards === '' ? 0 : Number(d.yellowCards),
      redCards: d.redCards === '' ? 0 : Number(d.redCards),
      rating: d.rating === '' ? null : Number(d.rating),
    };
  });
}

function playersForTeams(
  teams: Team[],
  homeTeamId: string | null,
  awayTeamId: string | null,
): { home: TeamPlayer[]; away: TeamPlayer[] } {
  const home = teams.find((t) => t.id === homeTeamId);
  const away = teams.find((t) => t.id === awayTeamId);
  return {
    home: (home?.players ?? []).map((p) => ({ ...p, teamId: home!.id })),
    away: (away?.players ?? []).map((p) => ({ ...p, teamId: away!.id })),
  };
}

export function PlayerStatsForm({
  teams,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  winnerTeamId,
  isDraw,
  drafts,
  onChange,
  mvpPlayerId,
  onMvpChange,
  mvpMode = 'AUTO',
  settingsWeights,
  showDiscipline = false,
  statFields,
}: {
  teams: Team[];
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  winnerTeamId: string | null;
  isDraw: boolean;
  drafts: Record<string, PlayerStatDraft>;
  onChange: (playerId: string, field: keyof PlayerStatDraft, value: string) => void;
  mvpPlayerId: string;
  onMvpChange: (playerId: string) => void;
  mvpMode?: 'AUTO' | 'MANUAL';
  settingsWeights?: unknown;
  showDiscipline?: boolean;
  statFields?: Array<
    'goals' | 'assists' | 'points' | 'kills' | 'deaths' | 'rating' | 'yellowCards' | 'redCards'
  >;
}) {
  const { home, away } = playersForTeams(teams, homeTeamId, awayTeamId);
  const all = [...home, ...away];

  const visibleFields = useMemo(() => {
    const allFields = [
      ['goals', 'G'],
      ['assists', 'A'],
      ['points', 'Pts'],
      ['kills', 'K'],
      ['deaths', 'D'],
      ['yellowCards', 'YC'],
      ['redCards', 'RC'],
      ['rating', 'Rating'],
    ] as const;
    if (statFields?.length) {
      return allFields.filter(([field]) =>
        statFields.includes(field as (typeof statFields)[number]),
      );
    }
    if (showDiscipline) {
      return allFields.filter(
        ([field]) => field !== 'kills' && field !== 'deaths',
      );
    }
    return allFields.filter(
      ([field]) => field !== 'yellowCards' && field !== 'redCards',
    );
  }, [statFields, showDiscipline]);

  const suggestedMvp = useMemo(() => {
    if (!all.length) return null;
    const weights = mvpWeightsSchema.parse(settingsWeights ?? {});
    const payload = draftsToPayload(drafts, all);
    const rows = payload.map((s) => {
      const player = all.find((p) => p.id === s.playerId)!;
      const team =
        s.teamId === homeTeamId ? homeTeamName : awayTeamName;
      const isOnWinningTeam =
        !isDraw && winnerTeamId != null && s.teamId === winnerTeamId;
      return {
        playerId: s.playerId,
        playerName: player.name,
        teamId: s.teamId,
        teamName: team,
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
        points: s.points ?? 0,
        kills: s.kills ?? 0,
        deaths: s.deaths ?? 0,
        rating: s.rating ?? null,
        mvpScore: computePlayerMvpScore(s, weights, isOnWinningTeam),
        isMvp: false,
        isOnWinningTeam,
      };
    });
    return resolveMatchMvp(rows, mvpMode === 'MANUAL' ? mvpPlayerId || null : mvpPlayerId || null);
  }, [
    all,
    drafts,
    homeTeamId,
    homeTeamName,
    awayTeamName,
    isDraw,
    winnerTeamId,
    mvpPlayerId,
    mvpMode,
    settingsWeights,
  ]);

  if (!all.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Add player names when creating the tournament to track MVP stats.
      </p>
    );
  }

  function renderTeam(
    label: string,
    players: TeamPlayer[],
  ) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
          {label}
        </p>
        {players.map((p) => {
          const d = drafts[p.id] ?? emptyStatDraft();
          const row = suggestedMvp?.rows.find((r) => r.playerId === p.id);
          return (
            <div
              key={p.id}
              className={`rounded-lg border border-[var(--color-line)] p-3 ${
                row?.isMvp ? 'ring-1 ring-amber-400/40 bg-amber-500/5' : ''
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold">{p.name}</p>
                {row && (
                  <span className="text-[10px] font-bold tabular-nums text-[var(--color-muted)]">
                    MVP score: {row.mvpScore}
                    {row.isMvp && (
                      <span className="ml-1 text-amber-400">★ MVP</span>
                    )}
                  </span>
                )}
              </div>
              <div
                className={`grid gap-2 grid-cols-3 sm:grid-cols-${Math.min(6, visibleFields.length)}`}
                style={{
                  gridTemplateColumns: `repeat(${Math.min(visibleFields.length, 6)}, minmax(0, 1fr))`,
                }}
              >
                {visibleFields.map(([field, short]) => (
                  <div key={field}>
                    <Label className="text-[10px]">{short}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={field === 'rating' ? 10 : undefined}
                      step={field === 'rating' ? 0.1 : 1}
                      value={d[field]}
                      onChange={(e) => onChange(p.id, field, e.target.value)}
                      className="mt-0.5 h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Player stats (for MVP calculation)</Label>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Goals/assists for football · K/D for esports · Rating 0–10 optional.
          {mvpMode === 'AUTO'
            ? ' MVP is auto-calculated from stats + win bonus.'
            : ' Pick MVP manually below.'}
        </p>
      </div>

      {renderTeam(homeTeamName, home)}
      {renderTeam(awayTeamName, away)}

      <div>
        <Label>Player of the Match</Label>
        <select
          className="panel-card field-select mt-1 w-full"
          value={mvpPlayerId}
          onChange={(e) => onMvpChange(e.target.value)}
        >
          <option value="">
            {mvpMode === 'AUTO' ? 'Auto (highest MVP score)' : 'Select MVP…'}
          </option>
          {all.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {suggestedMvp?.mvpPlayerId && mvpMode === 'AUTO' && !mvpPlayerId && (
          <p className="mt-1 text-xs text-amber-400/90">
            Suggested MVP:{' '}
            {all.find((p) => p.id === suggestedMvp.mvpPlayerId)?.name}
          </p>
        )}
      </div>
    </div>
  );
}

export function getPlayersForMatch(teams: Team[], match: {
  homeTeamId: string | null;
  awayTeamId: string | null;
}): TeamPlayer[] {
  const { home, away } = playersForTeams(
    teams,
    match.homeTeamId,
    match.awayTeamId,
  );
  return [...home, ...away];
}
