'use client';

import { formatShareDateTime, resolveRoundLabel, resolveGameProfile, type GameProfile, type MatchEntryMode, type TournamentSettings } from '@bracket/shared';

import { useMemo, useState } from 'react';
import { CricketMatchEntryOptions } from '@/components/cricket-match-entry-options';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MatchResultView, matchToResultData } from '@/components/match-result-view';
import {
  PlayerStatsForm,
  draftsFromMatchStats,
  draftsToPayload,
  emptyStatDraft,
  getPlayersForMatch,
  type PlayerStatDraft,
} from '@/components/player-stats-form';
import { api } from '@/lib/api';
import type { Match, Tournament } from '@/lib/types';
import {
  buildMatchMetaFromDraft,
  GameMatchEntryFields,
  type GameMatchDraft,
} from '@/components/game-match-entry-fields';

type Filter = 'pending' | 'done' | 'all';

type MatchDraft = GameMatchDraft & {
  winnerTeamId: string;
  isDraw: boolean;
  force: boolean;
  winnersOnly: boolean;
  showDetails: boolean;
  playerDrafts: Record<string, PlayerStatDraft>;
  mvpPlayerId: string;
};

function defaultDraft(m: Match): MatchDraft {
  const meta = m.matchMeta;
  return {
    homeScore: m.homeScore != null ? String(m.homeScore) : '',
    awayScore: m.awayScore != null ? String(m.awayScore) : '',
    homePercent: m.homePercent != null ? String(m.homePercent) : '',
    awayPercent: m.awayPercent != null ? String(m.awayPercent) : '',
    winnerTeamId: m.winnerTeamId ?? '',
    isDraw: m.isDraw,
    force: m.status === 'COMPLETED',
    winnersOnly: false,
    showDetails: false,
    playerDrafts: {},
    mvpPlayerId: m.mvpPlayerId ?? '',
    etHomeScore: m.etHomeScore != null ? String(m.etHomeScore) : '',
    etAwayScore: m.etAwayScore != null ? String(m.etAwayScore) : '',
    penHomeScore: m.penHomeScore != null ? String(m.penHomeScore) : '',
    penAwayScore: m.penAwayScore != null ? String(m.penAwayScore) : '',
    attackStartAt: meta?.attackStartAt
      ? new Date(meta.attackStartAt).toISOString().slice(0, 16)
      : '',
    warHours: meta?.warHours != null ? String(meta.warHours) : '24',
    htHomeScore: meta?.htHomeScore != null ? String(meta.htHomeScore) : '',
    htAwayScore: meta?.htAwayScore != null ? String(meta.htAwayScore) : '',
    homeMapsWon: meta?.homeMapsWon != null ? String(meta.homeMapsWon) : '',
    awayMapsWon: meta?.awayMapsWon != null ? String(meta.awayMapsWon) : '',
  };
}

function isEliminationMatch(tournament: Tournament, m: Match) {
  return (
    tournament.format === 'SINGLE_ELIMINATION' ||
    tournament.format === 'DOUBLE_ELIMINATION' ||
    (tournament.format === 'GROUPS_KNOCKOUT' && m.bracketSide !== 'GROUP')
  );
}

function allowsDraw(tournament: Tournament, m: Match) {
  return (
    tournament.format === 'ROUND_ROBIN' ||
    (tournament.format === 'GROUPS_KNOCKOUT' && m.bracketSide === 'GROUP')
  );
}

function validateMatchDraft(
  tournament: Tournament,
  match: Match,
  draft: MatchDraft,
  settings: TournamentSettings,
): string | null {
  if (!match.homeTeamId || !match.awayTeamId) {
    return 'Both teams must be assigned before you can save a score.';
  }
  const homeScore = draft.homeScore === '' ? 0 : Number(draft.homeScore);
  const awayScore = draft.awayScore === '' ? 0 : Number(draft.awayScore);
  if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
    return 'Enter valid numbers for both scores.';
  }
  if (homeScore < 0 || awayScore < 0) {
    return 'Scores cannot be negative.';
  }

  const isElim = isEliminationMatch(tournament, match);
  if (isElim && homeScore === awayScore && !draft.isDraw) {
    const etHome = draft.etHomeScore === '' ? null : Number(draft.etHomeScore);
    const etAway = draft.etAwayScore === '' ? null : Number(draft.etAwayScore);
    const penHome = draft.penHomeScore === '' ? null : Number(draft.penHomeScore);
    const penAway = draft.penAwayScore === '' ? null : Number(draft.penAwayScore);

    if (
      settings.knockoutExtraTime &&
      etHome != null &&
      etAway != null &&
      !Number.isNaN(etHome) &&
      !Number.isNaN(etAway) &&
      homeScore + etHome !== awayScore + etAway
    ) {
      return null;
    }
    if (
      settings.knockoutPenalties !== false &&
      penHome != null &&
      penAway != null &&
      !Number.isNaN(penHome) &&
      !Number.isNaN(penAway) &&
      penHome !== penAway
    ) {
      return null;
    }
    if (!draft.winnerTeamId) {
      return 'Knockout ties need a winner — enter extra time or penalty scores, or pick the winner below.';
    }
  }

  if (
    !isElim &&
    !allowsDraw(tournament, match) &&
    homeScore === awayScore &&
    !draft.isDraw &&
    !draft.winnerTeamId
  ) {
    return 'Provide a winner or mark the match as a draw.';
  }

  return null;
}

export function MatchEntryBoard({
  tournament,
  token,
  slug,
  defaultFilter = 'all',
  onSharePrematch,
  onShareResult,
  onShareCard,
}: {
  tournament: Tournament;
  token: string;
  slug: string;
  defaultFilter?: Filter;
  onSharePrematch?: (matchId: string) => void;
  onShareResult?: (matchId: string) => void;
  onShareCard?: (matchId: string) => void;
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const [drafts, setDrafts] = useState<Record<string, MatchDraft>>({});
  const [error, setError] = useState('');
  const [matchErrors, setMatchErrors] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const gameProfile = useMemo(
    () => resolveGameProfile({ gameName: tournament.game?.name }),
    [tournament.game?.name],
  );
  const quickWinMode = settings.quickAdvanceWinnersOnly === true;
  const mvpEnabled = settings.enableMvp !== false;
  const isCricket = gameProfile.matchEntry === 'cricket';
  const matchEntryMode = gameProfile.matchEntry;

  const playable = useMemo(
    () =>
      tournament.matches.filter(
        (m) => m.homeTeamId && m.awayTeamId && !m.isBye,
      ),
    [tournament.matches],
  );

  const completedCount = playable.filter((m) => m.status === 'COMPLETED').length;

  const filtered = useMemo(() => {
    const list =
      filter === 'all'
        ? [...tournament.matches]
            .filter((m) => !m.isBye)
            .sort((a, b) => {
              const stageOrder = (m: Match) =>
                m.bracketSide === 'GROUP'
                  ? 0
                  : m.bracketSide === 'SWISS'
                    ? 1
                    : 2;
              const sa = stageOrder(a);
              const sb = stageOrder(b);
              if (sa !== sb) return sa - sb;
              if (a.round !== b.round) return a.round - b.round;
              if (a.position !== b.position) return a.position - b.position;
              return a.key.localeCompare(b.key);
            })
        : [...playable].sort((a, b) => {
            if (a.round !== b.round) return a.round - b.round;
            if (a.position !== b.position) return a.position - b.position;
            return a.key.localeCompare(b.key);
          });
    if (filter === 'pending') {
      return list.filter((m) => m.status !== 'COMPLETED');
    }
    if (filter === 'done') {
      return list.filter((m) => m.status === 'COMPLETED');
    }
    return list;
  }, [playable, filter, tournament.matches]);

  const pendingCount = playable.filter((m) => m.status !== 'COMPLETED').length;

  const sections = useMemo(() => {
    const out: { key: string; title: string; matches: Match[] }[] = [];
    const group = filtered.filter((m) => m.bracketSide === 'GROUP');
    const swiss = filtered.filter((m) => m.bracketSide === 'SWISS');
    const ko = filtered.filter(
      (m) => m.bracketSide !== 'GROUP' && m.bracketSide !== 'SWISS',
    );
    if (group.length) out.push({ key: 'group', title: 'Group stage', matches: group });
    if (swiss.length) out.push({ key: 'swiss', title: 'Swiss stage', matches: swiss });
    if (ko.length) out.push({ key: 'knockout', title: 'Knockout stage', matches: ko });
    if (!out.length && filtered.length) {
      out.push({ key: 'all', title: 'Matches', matches: filtered });
    }
    return out;
  }, [filtered]);

  function getDraft(m: Match): MatchDraft {
    return drafts[m.id] ?? defaultDraft(m);
  }

  function patchDraft(matchId: string, m: Match, patch: Partial<MatchDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? defaultDraft(m)), ...patch },
    }));
  }

  const saveMutation = useMutation({
    mutationFn: async ({
      match,
      draft,
      quick,
    }: {
      match: Match;
      draft: MatchDraft;
      quick?: 'home' | 'away' | 'draw' | 'forfeit-home' | 'forfeit-away';
    }) => {
      let homeScore = draft.homeScore === '' ? 0 : Number(draft.homeScore);
      let awayScore = draft.awayScore === '' ? 0 : Number(draft.awayScore);
      let winnerTeamId = draft.winnerTeamId || null;
      let isDraw = draft.isDraw;
      let winnersOnly = draft.winnersOnly;

      if (quick === 'home' && match.homeTeamId) {
        if (quickWinMode) {
          winnersOnly = true;
          homeScore = 0;
          awayScore = 0;
          winnerTeamId = match.homeTeamId;
          isDraw = false;
        } else if (isEliminationMatch(tournament, match)) {
          homeScore = 1;
          awayScore = 0;
          winnerTeamId = match.homeTeamId;
          isDraw = false;
        } else {
          const a = draft.awayScore === '' ? 0 : Number(draft.awayScore);
          const h = draft.homeScore === '' ? 0 : Number(draft.homeScore);
          homeScore = Math.max(h, a + 1, 1);
          awayScore = a;
          winnerTeamId = match.homeTeamId;
          isDraw = false;
        }
      } else if (quick === 'away' && match.awayTeamId) {
        if (quickWinMode) {
          winnersOnly = true;
          homeScore = 0;
          awayScore = 0;
          winnerTeamId = match.awayTeamId;
          isDraw = false;
        } else if (isEliminationMatch(tournament, match)) {
          homeScore = 0;
          awayScore = 1;
          winnerTeamId = match.awayTeamId;
          isDraw = false;
        } else {
          const h = draft.homeScore === '' ? 0 : Number(draft.homeScore);
          const a = draft.awayScore === '' ? 0 : Number(draft.awayScore);
          awayScore = Math.max(a, h + 1, 1);
          homeScore = h;
          winnerTeamId = match.awayTeamId;
          isDraw = false;
        }
      } else if (quick === 'draw') {
        isDraw = true;
        winnerTeamId = null;
        if (homeScore !== awayScore) {
          homeScore = awayScore = Math.max(homeScore, awayScore, 0);
        }
      }

      const isForfeit =
        quick === 'forfeit-home' || quick === 'forfeit-away';
      const forfeitSide =
        quick === 'forfeit-home'
          ? 'home'
          : quick === 'forfeit-away'
            ? 'away'
            : undefined;

      const players = getPlayersForMatch(tournament.teams, match);
      let playerDrafts = draft.playerDrafts;
      if (
        !Object.keys(playerDrafts).length &&
        match.playerStats?.length &&
        draft.showDetails
      ) {
        playerDrafts = draftsFromMatchStats(
          players,
          match.playerStats.map((s) => ({
            playerId: s.playerId,
            goals: s.goals,
            assists: s.assists,
            points: s.points,
            kills: s.kills,
            deaths: s.deaths,
            rating: s.rating,
          })),
        );
      }

      return api(`/matches/${match.id}/result`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          homeScore,
          awayScore,
          homePercent:
            draft.homePercent === '' ? null : Number(draft.homePercent),
          awayPercent:
            draft.awayPercent === '' ? null : Number(draft.awayPercent),
          winnerTeamId,
          isDraw,
          force: draft.force,
          winnersOnly,
          isForfeit,
          forfeitSide,
          mvpPlayerId: draft.mvpPlayerId || null,
          playerStats:
            players.length > 0
              ? draftsToPayload(playerDrafts, players)
              : [],
          etHomeScore: draft.etHomeScore === '' ? null : Number(draft.etHomeScore),
          etAwayScore: draft.etAwayScore === '' ? null : Number(draft.etAwayScore),
          penHomeScore: draft.penHomeScore === '' ? null : Number(draft.penHomeScore),
          penAwayScore: draft.penAwayScore === '' ? null : Number(draft.penAwayScore),
          matchMeta: buildMatchMetaFromDraft(matchEntryMode, draft),
        }),
      });
    },
    onSuccess: async (_, { match }) => {
      setSavingId(null);
      setError('');
      setMatchErrors((prev) => {
        const next = { ...prev };
        delete next[match.id];
        return next;
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[match.id];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ['tournament', slug] });
      await qc.invalidateQueries({ queryKey: ['tournament-mvp', slug] });
    },
    onError: (err: Error, { match }) => {
      setSavingId(null);
      setError(err.message);
      setMatchErrors((prev) => ({ ...prev, [match.id]: err.message }));
    },
  });

  const clearMutation = useMutation({
    mutationFn: (matchId: string) =>
      api(`/matches/${matchId}/result`, { method: 'DELETE', token }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function submit(match: Match, quick?: 'home' | 'away' | 'draw' | 'forfeit-home' | 'forfeit-away') {
    const draft = getDraft(match);
    if (!quick) {
      const validationError = validateMatchDraft(tournament, match, draft, settings);
      if (validationError) {
        setError(validationError);
        setMatchErrors((prev) => ({ ...prev, [match.id]: validationError }));
        return;
      }
    }
    setMatchErrors((prev) => {
      const next = { ...prev };
      delete next[match.id];
      return next;
    });
    setError('');
    setSavingId(match.id);
    saveMutation.mutate({ match, draft, quick });
  }

  function openDetails(m: Match) {
    const draft = getDraft(m);
    const players = getPlayersForMatch(tournament.teams, m);
    const playerDrafts =
      Object.keys(draft.playerDrafts).length > 0
        ? draft.playerDrafts
        : draftsFromMatchStats(
            players,
            m.playerStats?.map((s) => ({
              playerId: s.playerId,
              goals: s.goals,
              assists: s.assists,
              points: s.points,
              kills: s.kills,
              deaths: s.deaths,
              rating: s.rating,
            })) ?? [],
          );
    patchDraft(m.id, m, { showDetails: true, playerDrafts });
  }

  if (!playable.length && !tournament.matches.some((m) => !m.isBye)) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No playable matches yet
        {tournament.format === 'GROUPS_KNOCKOUT'
          ? ' — finish group stage to seed knockout.'
          : '.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['all', `All (${tournament.matches.filter((m) => !m.isBye).length})`],
            ['pending', `To play (${pendingCount})`],
            ['done', `Completed (${completedCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === key
                ? 'bg-[var(--color-accent)] text-[#0a0c10]'
                : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {label}
          </button>
        ))}
        {pendingCount > 0 && filter !== 'pending' && (
          <span className="text-xs text-[var(--color-muted)]">
            {pendingCount} match{pendingCount === 1 ? '' : 'es'} waiting
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {sections.map((section) => {
        const koMatches = tournament.matches.filter(
          (x) => x.bracketSide !== 'GROUP' && x.bracketSide !== 'SWISS',
        );
        const totalRounds = koMatches.length
          ? Math.max(...koMatches.map((x) => x.round))
          : undefined;

        const roundGroups = new Map<number, Match[]>();
        for (const m of section.matches) {
          const arr = roundGroups.get(m.round) ?? [];
          arr.push(m);
          roundGroups.set(m.round, arr);
        }

        return (
          <div key={section.key} className="space-y-4">
            <h2 className="font-display text-lg font-semibold">{section.title}</h2>
            {[...roundGroups.entries()]
              .sort(([a], [b]) => a - b)
              .map(([round, matches]) => {
                const roundLabel = resolveRoundLabel(round, settings, totalRounds);
                return (
                  <section key={`${section.key}-${round}`}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                      {roundLabel}
                    </h3>
                    <div className="space-y-3">
                      {matches.map((m) => (
                        <MatchEntryCard
                          key={m.id}
                          match={m}
                          tournament={tournament}
                          draft={getDraft(m)}
                          saving={savingId === m.id}
                          matchError={matchErrors[m.id]}
                          quickWinMode={quickWinMode}
                          mvpEnabled={mvpEnabled}
                          mvpMode={settings.mvpMode ?? 'AUTO'}
                          mvpWeights={settings.mvpWeights ?? gameProfile.mvpWeights}
                          mvpStatFields={gameProfile.mvpStatFields}
                          useFairPlay={settings.useFairPlayTiebreaker === true}
                          knockoutExtraTime={settings.knockoutExtraTime === true}
                          knockoutPenalties={settings.knockoutPenalties !== false}
                          twoLeggedKnockout={settings.twoLeggedKnockout === true}
                          onPatch={(patch) => {
                            patchDraft(m.id, m, patch);
                            setMatchErrors((prev) => {
                              if (!prev[m.id]) return prev;
                              const next = { ...prev };
                              delete next[m.id];
                              return next;
                            });
                            if (error) setError('');
                          }}
                          onQuickWin={(side) => submit(m, side)}
                          onSave={() => submit(m)}
                          onClear={() => clearMutation.mutate(m.id)}
                          onOpenDetails={() => openDetails(m)}
                          isElim={isEliminationMatch(tournament, m)}
                          allowDraw={allowsDraw(tournament, m)}
                          onSharePrematch={onSharePrematch}
                          onShareResult={onShareResult}
                          onShareCard={onShareCard}
                          allowAttachments={
                            (settings as { allowMatchAttachments?: boolean })
                              ?.allowMatchAttachments === true
                          }
                          tournamentId={tournament.id}
                          token={token}
                          slug={slug}
                          isCricket={isCricket}
                          matchEntryMode={matchEntryMode}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
          </div>
        );
      })}

      {!filtered.length && (
        <p className="text-sm text-[var(--color-muted)]">
          {filter === 'pending'
            ? 'All matches completed — nice work!'
            : 'No matches in this view.'}
        </p>
      )}
    </div>
  );
}

function MatchEntryCard({
  match: m,
  tournament,
  draft,
  saving,
  matchError,
  quickWinMode,
  mvpEnabled,
  mvpMode,
  mvpWeights,
  mvpStatFields,
  useFairPlay,
  knockoutExtraTime,
  knockoutPenalties,
  twoLeggedKnockout,
  onPatch,
  onQuickWin,
  onSave,
  onClear,
  onOpenDetails,
  isElim,
  allowDraw,
  onSharePrematch,
  onShareResult,
  onShareCard,
  allowAttachments,
  tournamentId,
  token,
  slug,
  isCricket,
  matchEntryMode,
}: {
  match: Match;
  tournament: Tournament;
  draft: MatchDraft;
  saving: boolean;
  matchError?: string;
  quickWinMode: boolean;
  mvpEnabled: boolean;
  mvpMode: 'AUTO' | 'MANUAL';
  mvpWeights?: unknown;
  useFairPlay?: boolean;
  knockoutExtraTime?: boolean;
  knockoutPenalties?: boolean;
  twoLeggedKnockout?: boolean;
  onPatch: (patch: Partial<MatchDraft>) => void;
  onQuickWin: (side: 'home' | 'away' | 'draw' | 'forfeit-home' | 'forfeit-away') => void;
  onSave: () => void;
  onClear: () => void;
  onOpenDetails: () => void;
  isElim: boolean;
  allowDraw: boolean;
  onSharePrematch?: (matchId: string) => void;
  onShareResult?: (matchId: string) => void;
  onShareCard?: (matchId: string) => void;
  allowAttachments?: boolean;
  tournamentId: string;
  token: string;
  slug: string;
  isCricket?: boolean;
  matchEntryMode: MatchEntryMode;
  mvpStatFields?: GameProfile['mvpStatFields'];
}) {
  const scheduleMutation = useMutation({
    mutationFn: async (body: { scheduledAt?: string | null; station?: string | null }) =>
      api(`/matches/${m.id}/schedule`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
  });
  const attachmentMutation = useMutation({
    mutationFn: async (body: {
      attachmentUrl?: string | null;
      attachmentName?: string | null;
    }) =>
      api(`/matches/${m.id}/attachment`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
  });
  const done = m.status === 'COMPLETED';
  const home = m.homeTeam?.name ?? 'TBD';
  const away = m.awayTeam?.name ?? 'TBD';
  const teamsReady = !!(m.homeTeamId && m.awayTeamId);
  const requireCheckIn =
    (tournament.settings as { requireCheckIn?: boolean } | undefined)
      ?.requireCheckIn === true;
  const checkInBlocked =
    requireCheckIn &&
    !done &&
    teamsReady &&
    (!m.homeTeam?.checkedIn || !m.awayTeam?.checkedIn);
  const saveBlocked = checkInBlocked || !teamsReady;
  const scoresTied =
    draft.homeScore !== '' &&
    draft.awayScore !== '' &&
    Number(draft.homeScore) === Number(draft.awayScore);
  const showEtPen =
    !done &&
    isElim &&
    (knockoutExtraTime || knockoutPenalties || (twoLeggedKnockout && m.legNumber === 2));

  if (done && !draft.showDetails) {
    return (
      <div className="gaming-card rounded-xl p-3">
        <MatchResultView
          data={matchToResultData(m, tournament)}
          variant="compact"
          hideSeeds={
            (tournament.settings as { hideSeedNumbers?: boolean } | undefined)
              ?.hideSeedNumbers === true
          }
        />
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onPatch({ showDetails: true, force: true })}
          >
            Edit
          </Button>
        </div>
      </div>
    );
  }

  const showScores = !quickWinMode || draft.showDetails;

  return (
    <div
      className={`gaming-card rounded-xl border p-4 transition ${
        !done
          ? 'border-[var(--color-accent)]/30 shadow-sm'
          : 'border-[var(--color-line)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[var(--color-muted)]">
          <p>
            {m.bracketSide.replaceAll('_', ' ')}
            {!done && (
              <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700">
                To play
              </span>
            )}
          </p>
          {(m.scheduledAt || m.station) && (
            <p className="mt-1 text-[var(--color-fg)]">
              {m.scheduledAt && formatShareDateTime(m.scheduledAt)}
              {m.scheduledAt && m.station ? ' · ' : ''}
              {m.station}
            </p>
          )}
          {(m.bestOf ?? 0) > 1 && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Best of {m.bestOf} series
            </p>
          )}
          {m.isForfeit && (
            <p className="mt-1 text-xs font-semibold text-amber-700">
              Walkover / forfeit
            </p>
          )}
        </div>
      </div>

      {checkInBlocked && (
        <p className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-900">
          Check-in required before reporting results:{' '}
          {!m.homeTeam?.checkedIn && `${home} not checked in`}
          {!m.homeTeam?.checkedIn && !m.awayTeam?.checkedIn ? '; ' : ''}
          {!m.awayTeam?.checkedIn && `${away} not checked in`}
        </p>
      )}

      {!teamsReady && !done && (
        <p className="mt-2 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)]">
          Waiting for both teams — complete earlier rounds or group games to fill this slot.
        </p>
      )}

      {matchError && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {matchError}
        </p>
      )}

      {/* Quick win — primary action for hosts */}
      {!done && teamsReady && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={saving || checkInBlocked}
            onClick={() => onQuickWin('home')}
            className="rounded-lg border-2 border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-3 text-left font-semibold transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
          >
            <span className="block text-xs font-normal text-[var(--color-muted)]">
              {quickWinMode ? 'Advance winner' : 'Winner'}
            </span>
            {home}
          </button>
          <button
            type="button"
            disabled={saving || checkInBlocked}
            onClick={() => onQuickWin('away')}
            className="rounded-lg border-2 border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-3 text-left font-semibold transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
          >
            <span className="block text-xs font-normal text-[var(--color-muted)]">
              {quickWinMode ? 'Advance winner' : 'Winner'}
            </span>
            {away}
          </button>
        </div>
      )}

      {allowDraw && !done && (
        <Button
          type="button"
          variant="secondary"
          className="mt-2 w-full sm:w-auto"
          disabled={saving || checkInBlocked}
          onClick={() => onQuickWin('draw')}
        >
          Report draw
        </Button>
      )}

      {!done && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-xs text-amber-800"
            disabled={saving || checkInBlocked}
            onClick={() => onQuickWin('forfeit-home')}
          >
            {home} forfeit (walkover)
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-xs text-amber-800"
            disabled={saving || checkInBlocked}
            onClick={() => onQuickWin('forfeit-away')}
          >
            {away} forfeit (walkover)
          </Button>
        </div>
      )}

      {isCricket && !done && teamsReady && m.homeTeamId && m.awayTeamId && (
        <CricketMatchEntryOptions
          slug={slug}
          matchId={m.id}
          token={token}
          homeTeamId={m.homeTeamId}
          awayTeamId={m.awayTeamId}
          homeName={home}
          awayName={away}
          disabled={saveBlocked}
        />
      )}

      {/* Score entry (non-cricket) */}
      {showScores && teamsReady && !isCricket && (
        <form
          className="mt-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <GameMatchEntryFields
            mode={matchEntryMode}
            homeName={home}
            awayName={away}
            draft={draft}
            onChange={onPatch}
            showEtPen={showEtPen && (matchEntryMode === 'score' || matchEntryMode === 'football')}
            knockoutExtraTime={knockoutExtraTime}
            knockoutPenalties={knockoutPenalties}
          />
          <div className="mt-3">
            <Button type="submit" disabled={saving || saveBlocked}>
              {saving ? 'Saving…' : done ? 'Update' : 'Save score'}
            </Button>
          </div>

          {showEtPen && (matchEntryMode === 'score' || matchEntryMode === 'football') && (
            <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-line)] p-3">
              {knockoutExtraTime && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-muted)]">
                    Extra time (added to aggregate)
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{home} ET</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.etHomeScore}
                        onChange={(e) => onPatch({ etHomeScore: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{away} ET</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.etAwayScore}
                        onChange={(e) => onPatch({ etAwayScore: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
              {knockoutPenalties && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-muted)]">
                    Penalty shootout
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{home} pens</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.penHomeScore}
                        onChange={(e) => onPatch({ penHomeScore: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{away} pens</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.penAwayScore}
                        onChange={(e) => onPatch({ penAwayScore: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tournament.allowPercent && draft.showDetails && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{home} %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.homePercent}
                  onChange={(e) => onPatch({ homePercent: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">{away} %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.awayPercent}
                  onChange={(e) => onPatch({ awayPercent: e.target.value })}
                />
              </div>
            </div>
          )}

          {isElim && scoresTied && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <Label className="text-xs text-amber-900">
                Tied score — pick a winner or enter extra time / penalties above
              </Label>
              <select
                className="panel-card field-select mt-2 w-full"
                value={draft.winnerTeamId}
                onChange={(e) =>
                  onPatch({ winnerTeamId: e.target.value, isDraw: false })
                }
              >
                <option value="">Pick winner (optional if ET/pen resolves tie)</option>
                <option value={m.homeTeamId ?? ''}>{home}</option>
                <option value={m.awayTeamId ?? ''}>{away}</option>
              </select>
            </div>
          )}

          {done && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.force}
                onChange={(e) => onPatch({ force: e.target.checked })}
              />
              Force overwrite
            </label>
          )}
        </form>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-3">
        {!done && onSharePrematch && (
          <Button type="button" variant="ghost" onClick={() => onSharePrematch(m.id)}>
            Pre-match image
          </Button>
        )}
        {done && onShareResult && (
          <Button type="button" variant="ghost" onClick={() => onShareResult(m.id)}>
            Result image
          </Button>
        )}
        {done && onShareCard && (
          <Button type="button" variant="ghost" onClick={() => onShareCard(m.id)}>
            Quick share
          </Button>
        )}
        {!draft.showDetails ? (
          <Button type="button" variant="ghost" onClick={onOpenDetails}>
            {quickWinMode ? 'Enter scores / MVP' : 'More options'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onPatch({ showDetails: false })}
          >
            Less
          </Button>
        )}
        {done && draft.showDetails && (
          <Button type="button" variant="ghost" onClick={onClear}>
            Clear result
          </Button>
        )}
      </div>

      {draft.showDetails && (
        <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Station</Label>
            <Input
              className="mt-1"
              defaultValue={m.station ?? ''}
              placeholder="e.g. PC-3, Table A"
              onBlur={(e) =>
                scheduleMutation.mutate({
                  station: e.target.value.trim() || null,
                  scheduledAt: m.scheduledAt ?? null,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Scheduled time</Label>
            <Input
              className="mt-1"
              type="datetime-local"
              defaultValue={
                m.scheduledAt
                  ? new Date(m.scheduledAt).toISOString().slice(0, 16)
                  : ''
              }
              onBlur={(e) =>
                scheduleMutation.mutate({
                  station: m.station ?? null,
                  scheduledAt: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
            />
          </div>
        </div>
      )}

      {draft.showDetails && allowAttachments && (
        <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Attachment URL</Label>
            <Input
              className="mt-1"
              defaultValue={m.attachmentUrl ?? ''}
              placeholder="https://…"
              onBlur={(e) =>
                attachmentMutation.mutate({
                  attachmentUrl: e.target.value.trim() || null,
                  attachmentName: m.attachmentName ?? null,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Attachment label</Label>
            <Input
              className="mt-1"
              defaultValue={m.attachmentName ?? ''}
              placeholder="Replay link, VOD, etc."
              onBlur={(e) =>
                attachmentMutation.mutate({
                  attachmentUrl: m.attachmentUrl ?? null,
                  attachmentName: e.target.value.trim() || null,
                })
              }
            />
          </div>
        </div>
      )}

      {draft.showDetails && mvpEnabled && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <PlayerStatsForm
            teams={tournament.teams}
            homeTeamId={m.homeTeamId}
            awayTeamId={m.awayTeamId}
            homeTeamName={home}
            awayTeamName={away}
            winnerTeamId={
              draft.winnerTeamId ||
              (Number(draft.homeScore) > Number(draft.awayScore)
                ? m.homeTeamId
                : Number(draft.awayScore) > Number(draft.homeScore)
                  ? m.awayTeamId
                  : null)
            }
            isDraw={draft.isDraw}
            drafts={draft.playerDrafts}
            onChange={(playerId, field, value) =>
              onPatch({
                playerDrafts: {
                  ...draft.playerDrafts,
                  [playerId]: {
                    ...(draft.playerDrafts[playerId] ?? emptyStatDraft()),
                    [field]: value,
                  },
                },
              })
            }
            mvpPlayerId={draft.mvpPlayerId}
            onMvpChange={(id) => onPatch({ mvpPlayerId: id })}
            mvpMode={mvpMode}
            settingsWeights={mvpWeights}
            showDiscipline={useFairPlay === true}
            statFields={mvpStatFields}
          />
          <Button
            type="button"
            className="mt-3"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? 'Saving…' : 'Save with stats'}
          </Button>
        </div>
      )}
    </div>
  );
}
