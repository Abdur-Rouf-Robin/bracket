'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  CricketInningsStatus,
  REALTIME_EVENTS,
  teamsFromCricketToss,
  bowlingLegalBallsFromRows,
  canSelectBowler,
  defaultBowlerLimits,
  CRICKET_FORMAT_PRESETS,
  cricketFormatPreset,
  type BowlerLimitSettings,
  type CricketFormat,
  type CricketBallInput,
  type CricketScoreboard,
  type CricketWicketType,
} from '@bracket/shared';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CricketCoinToss } from '@/components/cricket-coin-toss-dynamic';
import { api } from '@/lib/api';
import type { Match, Team, Tournament } from '@/lib/types';

const SETUP_FORMATS = Object.keys(CRICKET_FORMAT_PRESETS) as CricketFormat[];

function parseSetupOvers(value: string, label = 'Overs') {
  const maxOvers = Number(value);
  if (!Number.isFinite(maxOvers) || maxOvers < 0 || maxOvers > 300) {
    throw new Error(`${label} must be between 0 (unlimited) and 300`);
  }
  return maxOvers;
}

function parseBallsPerOver(value: string) {
  const ballsPerOver = Number(value);
  if (!Number.isFinite(ballsPerOver) || ballsPerOver < 4 || ballsPerOver > 10) {
    throw new Error('Balls per over must be between 4 and 10');
  }
  return ballsPerOver;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

type TournamentProps = {
  variant?: 'tournament';
  match: Match;
  tournament: Tournament;
  token: string;
  canEdit: boolean;
};

type StandaloneProps = {
  variant: 'standalone';
  slug: string;
  editToken?: string;
  canEdit: boolean;
};

type Props = TournamentProps | StandaloneProps;

function isStandalone(p: Props): p is StandaloneProps {
  return p.variant === 'standalone';
}

function playersForTeam(team?: { players?: Array<{ id: string; name: string }> } | null) {
  return team?.players ?? [];
}

function playerOptions(
  players: Array<{ id: string; name: string }>,
  excludeId?: string | null,
) {
  return excludeId ? players.filter((p) => p.id !== excludeId) : players;
}

function bowlerOptions(
  players: Array<{ id: string; name: string }>,
  lastOverBowlerId?: string | null,
  overCompletePending = false,
  bowlingLegalBalls?: Record<string, number>,
  limits?: BowlerLimitSettings,
) {
  let list = players;
  if (overCompletePending && lastOverBowlerId) {
    list = list.filter((p) => p.id !== lastOverBowlerId);
  }
  if (bowlingLegalBalls && limits) {
    list = list.filter((p) => canSelectBowler(p.id, bowlingLegalBalls, limits));
  }
  return list;
}

export function CricketScoreboardPanel(props: Props) {
  const standalone = isStandalone(props);
  const match = standalone ? null : props.match;
  const tournament = standalone ? null : props.tournament;
  const token = standalone ? props.editToken : props.token;
  const canEdit = props.canEdit;
  const slug = standalone ? props.slug : props.tournament.slug;
  const boardKey = standalone ? ['cricket-standalone', slug] : ['cricket', match!.id];
  const apiBase = standalone
    ? `/cricket/standalone/${slug}`
    : `/matches/${match!.id}/cricket`;

  const apiOpts = (method: string, body?: unknown) => ({
    method,
    ...(standalone
      ? {
          headers: { 'x-cricket-edit-token': token ?? '' },
          body: body ? JSON.stringify(body) : undefined,
        }
      : {
          token,
          body: body ? JSON.stringify(body) : undefined,
        }),
  });

  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [wicketOpen, setWicketOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState<'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | null>(null);
  const [wicketType, setWicketType] = useState<CricketWicketType>('LBW');
  const [dismissedId, setDismissedId] = useState('');
  const [fielderId, setFielderId] = useState('');
  const [dlsOvers, setDlsOvers] = useState('');

  const [setupFormat, setSetupFormat] = useState<CricketFormat>('T20');
  const [customMaxOvers, setCustomMaxOvers] = useState('20');
  const [customBallsPerOver, setCustomBallsPerOver] = useState('6');
  const [maxOversPerBowler, setMaxOversPerBowler] = useState('4');
  const [maxBowlersAtLimit, setMaxBowlersAtLimit] = useState('5');
  const [strikeRotationMode, setStrikeRotationMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [inningsNum, setInningsNum] = useState(1);
  const [battingSide, setBattingSide] = useState<'home' | 'away'>('home');
  const [battingTeamId, setBattingTeamId] = useState(match?.homeTeamId ?? 'home');
  const [bowlingTeamId, setBowlingTeamId] = useState(match?.awayTeamId ?? 'away');
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [newBowlerId, setNewBowlerId] = useState('');
  const [newBatsmanId, setNewBatsmanId] = useState('');
  const [wicketPending, setWicketPending] = useState(false);
  const [tossWinnerId, setTossWinnerId] = useState(
    standalone ? 'home' : (match?.homeTeamId ?? ''),
  );
  const [tossDecision, setTossDecision] = useState<'BAT' | 'BOWL'>('BAT');

  const homeSide = standalone ? 'home' : (match?.homeTeamId ?? 'home');
  const awaySide = standalone ? 'away' : (match?.awayTeamId ?? 'away');

  const enableToss =
    standalone ||
    (tournament?.settings as { enableToss?: boolean } | undefined)?.enableToss ===
      true;

  const { data: board, isLoading } = useQuery({
    queryKey: boardKey,
    queryFn: () => api<CricketScoreboard>(apiBase),
  });

  useEffect(() => {
    const s = io(WS_URL, { transports: ['websocket'] });
    const roomId = standalone ? `standalone:${slug}` : tournament!.id;
    s.emit('tournament:join', { tournamentId: roomId });
    const onCricket = (payload: { matchId: string; scoreboard: CricketScoreboard }) => {
      const id = standalone ? slug : match!.id;
      if (payload.matchId === id) {
        qc.setQueryData(boardKey, payload.scoreboard);
      }
    };
    s.on(REALTIME_EVENTS.CRICKET_UPDATED, onCricket);
    return () => {
      s.emit('tournament:leave', { tournamentId: roomId });
      s.off(REALTIME_EVENTS.CRICKET_UPDATED, onCricket);
      s.disconnect();
    };
  }, [standalone, slug, tournament?.id, match?.id, qc, boardKey]);

  const battingTeam = useMemo(() => {
    if (standalone) {
      return battingSide === 'home'
        ? { players: board?.homeRoster ?? [] }
        : { players: board?.awayRoster ?? [] };
    }
    return match!.homeTeamId === battingTeamId ? match!.homeTeam : match!.awayTeam;
  }, [standalone, battingSide, board, battingTeamId, match]);

  const bowlingTeam = useMemo(() => {
    if (standalone) {
      return battingSide === 'home'
        ? { players: board?.awayRoster ?? [] }
        : { players: board?.homeRoster ?? [] };
    }
    return match!.homeTeamId === bowlingTeamId ? match!.homeTeam : match!.awayTeam;
  }, [standalone, battingSide, board, bowlingTeamId, match]);

  const activeInnings = board?.innings.find(
    (i) => i.status === CricketInningsStatus.IN_PROGRESS,
  );

  const maxWickets = activeInnings?.maxWicketsForInnings ?? board?.maxWickets ?? 10;
  const lastManStanding =
    !!activeInnings && activeInnings.wickets >= maxWickets - 1;
  const needsStriker = !!activeInnings && !activeInnings.strikerId;
  const needsNonStriker =
    !!activeInnings && !activeInnings.nonStrikerId && !lastManStanding;
  const needsNewBatsman = needsStriker || needsNonStriker;
  const needsBowlerChange = !!activeInnings && activeInnings.overCompletePending;
  const isManualStrike = (board?.strikeRotationMode ?? 'AUTO') === 'MANUAL';
  const canRecordBall =
    !!activeInnings &&
    !needsNewBatsman &&
    !needsBowlerChange &&
    !!activeInnings.strikerId &&
    !!activeInnings.currentBowlerId;

  const activeBattingRoster = useMemo(() => {
    if (!activeInnings) return [];
    if (standalone) {
      return activeInnings.battingTeamId === 'home'
        ? board?.homeRoster ?? []
        : board?.awayRoster ?? [];
    }
    return activeInnings.battingTeamId === match!.homeTeamId
      ? match!.homeTeam?.players ?? []
      : match!.awayTeam?.players ?? [];
  }, [activeInnings, standalone, board, match]);

  const activeBowlingRoster = useMemo(() => {
    if (!activeInnings) return [];
    if (standalone) {
      return activeInnings.bowlingTeamId === 'home'
        ? board?.homeRoster ?? []
        : board?.awayRoster ?? [];
    }
    return activeInnings.bowlingTeamId === match!.homeTeamId
      ? match!.homeTeam?.players ?? []
      : match!.awayTeam?.players ?? [];
  }, [activeInnings, standalone, board, match]);

  const bowlerLimitSettings = useMemo((): BowlerLimitSettings | undefined => {
    if (!board) return undefined;
    return {
      maxOversPerBowler: board.maxOversPerBowler,
      maxBowlersAtLimit: board.maxBowlersAtLimit,
      ballsPerOver: board.ballsPerOver,
    };
  }, [board]);

  const activeBowlingLegalBalls = useMemo(() => {
    if (!activeInnings) return {};
    return bowlingLegalBallsFromRows(activeInnings.bowling);
  }, [activeInnings]);

  const availableBatsmen = useMemo(() => {
    if (!activeInnings) return [];
    const outIds = new Set(
      activeInnings.batting.filter((b) => b.isOut).map((b) => b.playerId),
    );
    const atCrease = new Set(
      [activeInnings.strikerId, activeInnings.nonStrikerId].filter(Boolean),
    );
    return activeBattingRoster.filter(
      (p) => !outIds.has(p.id) && !atCrease.has(p.id),
    );
  }, [activeInnings, activeBattingRoster]);

  const creaseBatsmen = useMemo(() => {
    if (!activeInnings) return [];
    return activeBattingRoster.filter(
      (p) =>
        p.id === activeInnings.strikerId || p.id === activeInnings.nonStrikerId,
    );
  }, [activeInnings, activeBattingRoster]);

  const incomingBatsmenOptions = useMemo(
    () => availableBatsmen.filter((p) => p.id !== dismissedId),
    [availableBatsmen, dismissedId],
  );

  function playerName(id: string | null | undefined) {
    if (!id) return null;
    return (
      activeBattingRoster.find((p) => p.id === id)?.name ??
      activeInnings?.batting.find((b) => b.playerId === id)?.playerName ??
      null
    );
  }

  useEffect(() => {
    if (!board?.configured) return;
    setCustomMaxOvers(String(board.maxOvers));
    setCustomBallsPerOver(String(board.ballsPerOver));
    setMaxOversPerBowler(String(board.maxOversPerBowler));
    setMaxBowlersAtLimit(String(board.maxBowlersAtLimit));
    if (board.format) setSetupFormat(board.format);
  }, [
    board?.configured,
    board?.maxOvers,
    board?.ballsPerOver,
    board?.maxOversPerBowler,
    board?.maxBowlersAtLimit,
    board?.format,
  ]);

  useEffect(() => {
    if (!board?.toss) return;
    const homeKey = standalone ? 'home' : match?.homeTeamId;
    const awayKey = standalone ? 'away' : match?.awayTeamId;
    if (!homeKey || !awayKey) return;

    const { battingTeamId, bowlingTeamId } = teamsFromCricketToss(
      board.toss,
      homeKey,
      awayKey,
    );

    if (standalone) {
      setBattingSide(battingTeamId as 'home' | 'away');
    } else {
      setBattingTeamId(battingTeamId);
      setBowlingTeamId(bowlingTeamId);
    }
  }, [board?.toss, standalone, match?.homeTeamId, match?.awayTeamId]);

  function buildSetupPayload() {
    return {
      format: setupFormat,
      strikeRotationMode,
      maxOvers: parseSetupOvers(customMaxOvers),
      ballsPerOver: parseBallsPerOver(customBallsPerOver),
      maxOversPerBowler: parseSetupOvers(maxOversPerBowler, 'Max overs per bowler'),
      maxBowlersAtLimit: parseSetupOvers(maxBowlersAtLimit, 'Bowlers at max'),
      inningsCount: cricketFormatPreset(setupFormat).inningsCount,
    };
  }

  function selectSetupFormat(format: CricketFormat) {
    setSetupFormat(format);
    const preset = cricketFormatPreset(format);
    setCustomMaxOvers(String(preset.maxOvers));
    setCustomBallsPerOver(String(preset.ballsPerOver));
    const limits = defaultBowlerLimits(preset.maxOvers, format);
    setMaxOversPerBowler(String(limits.maxOversPerBowler));
    setMaxBowlersAtLimit(String(limits.maxBowlersAtLimit));
  }

  const matchScoringStarted = !!board?.innings.some((i) => i.legalBalls > 0);
  const needsToss =
    enableToss && inningsNum === 1 && !board?.toss && !matchScoringStarted;

  const tossMut = useMutation({
    mutationFn: () =>
      api<CricketScoreboard>(
        `${apiBase}/toss`,
        apiOpts(
          'POST',
          standalone
            ? {
                winnerSide: tossWinnerId as 'home' | 'away',
                decision: tossDecision,
              }
            : {
                winnerTeamId: tossWinnerId,
                decision: tossDecision,
              },
        ),
      ),
    onSuccess: (data) => {
      qc.setQueryData(boardKey, data);
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const parsedCustomOvers = Number(customMaxOvers);
  const inningsMaxOvers =
    activeInnings?.revisedMaxOvers ??
    board?.maxOvers ??
    (Number.isFinite(parsedCustomOvers) ? parsedCustomOvers : 20);

  const startMut = useMutation({
    mutationFn: async () => {
      const payload = buildSetupPayload();
      const needsSetup =
        !board?.configured ||
        board.maxOvers !== payload.maxOvers ||
        board.ballsPerOver !== payload.ballsPerOver ||
        board.maxOversPerBowler !== payload.maxOversPerBowler ||
        board.maxBowlersAtLimit !== payload.maxBowlersAtLimit ||
        (board.format ?? 'T20') !== payload.format;

      if (needsSetup && !matchScoringStarted) {
        await api(`${apiBase}/setup`, apiOpts('POST', payload));
      }

      return api(
        `${apiBase}/innings/start`,
        apiOpts(
          'POST',
          standalone
            ? {
                inningsNumber: inningsNum,
                battingSide,
                strikerId,
                nonStrikerId,
                bowlerId,
              }
            : {
                inningsNumber: inningsNum,
                battingTeamId,
                bowlingTeamId,
                strikerId,
                nonStrikerId,
                bowlerId,
              },
        ),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: boardKey }),
    onError: (e: Error) => setError(e.message),
  });

  const ballMut = useMutation({
    mutationFn: (body: CricketBallInput) =>
      api<CricketScoreboard>(`${apiBase}/ball`, apiOpts('POST', body)),
    onSuccess: (data) => {
      qc.setQueryData(boardKey, data);
      setWicketOpen(false);
      setExtraOpen(null);
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const undoMut = useMutation({
    mutationFn: () => api<CricketScoreboard>(`${apiBase}/undo`, apiOpts('POST')),
    onSuccess: (data) => qc.setQueryData(boardKey, data),
    onError: (e: Error) => setError(e.message),
  });

  const bowlerMut = useMutation({
    mutationFn: () =>
      api<CricketScoreboard>(`${apiBase}/bowler`, apiOpts('POST', { bowlerId: newBowlerId })),
    onSuccess: (data) => qc.setQueryData(boardKey, data),
    onError: (e: Error) => setError(e.message),
  });

  const batsmenMut = useMutation({
    mutationFn: (body: { strikerId?: string; nonStrikerId?: string }) =>
      api<CricketScoreboard>(`${apiBase}/batsmen`, apiOpts('POST', body)),
    onSuccess: (data) => {
      qc.setQueryData(boardKey, data);
      setNewBatsmanId('');
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const swapStrikeMut = useMutation({
    mutationFn: () => api<CricketScoreboard>(`${apiBase}/swap-strike`, apiOpts('POST')),
    onSuccess: (data) => qc.setQueryData(boardKey, data),
    onError: (e: Error) => setError(e.message),
  });

  const endMut = useMutation({
    mutationFn: (reason: string) =>
      api<CricketScoreboard>(`${apiBase}/innings/end`, apiOpts('POST', { reason })),
    onSuccess: (data) => {
      qc.setQueryData(boardKey, data);
      if (!standalone) void qc.invalidateQueries({ queryKey: ['tournament'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const declareMut = useMutation({
    mutationFn: () =>
      api<CricketScoreboard>(`${apiBase}/innings/declare`, apiOpts('POST', { inningsNumber: inningsNum })),
    onSuccess: (data) => qc.setQueryData(boardKey, data),
    onError: (e: Error) => setError(e.message),
  });

  const followOnMut = useMutation({
    mutationFn: (enforce: boolean) =>
      api<CricketScoreboard>(`${apiBase}/follow-on`, apiOpts('POST', { enforce })),
    onSuccess: (data) => qc.setQueryData(boardKey, data),
    onError: (e: Error) => setError(e.message),
  });

  const dlsMut = useMutation({
    mutationFn: () =>
      api<CricketScoreboard>(`${apiBase}/dls`, apiOpts('POST', {
        revisedMaxOvers: Number(dlsOvers),
      })),
    onSuccess: (data) => qc.setQueryData(boardKey, data),
    onError: (e: Error) => setError(e.message),
  });

  const superOverMut = useMutation({
    mutationFn: () =>
      api<CricketScoreboard>(`${apiBase}/super-over/start`, apiOpts('POST', {
        strikerId,
        nonStrikerId,
        bowlerId,
      })),
    onSuccess: (data) => {
      qc.setQueryData(boardKey, data);
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const abandonMut = useMutation({
    mutationFn: (reason: 'NO_RESULT' | 'ABANDONED') =>
      api<CricketScoreboard>(`${apiBase}/abandon`, apiOpts('POST', { reason })),
    onSuccess: (data) => {
      qc.setQueryData(boardKey, data);
      if (!standalone) void qc.invalidateQueries({ queryKey: ['tournament'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const superOverPending = !!board?.superOverPending;

  const homeHasPlayers = standalone
    ? (board?.homeRoster?.length ?? 0) > 0
    : (match?.homeTeam?.players?.length ?? 0) > 0;
  const awayHasPlayers = standalone
    ? (board?.awayRoster?.length ?? 0) > 0
    : (match?.awayTeam?.players?.length ?? 0) > 0;
  const needsSquads = !standalone && canEdit && (!homeHasPlayers || !awayHasPlayers);

  const ensureSquadsMut = useMutation({
    mutationFn: () =>
      api<CricketScoreboard>(`${apiBase}/ensure-squads`, apiOpts('POST')),
    onSuccess: (data) => {
      qc.setQueryData(boardKey, data);
      if (!standalone && slug) {
        void qc.invalidateQueries({ queryKey: ['tournament', slug] });
      }
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const superInningsDone =
    board?.innings.filter(
      (i) => i.isSuperOver && i.status === CricketInningsStatus.COMPLETED,
    ).length ?? 0;

  const superOverTeams = useMemo(() => {
    if (!board) return null;
    const regular = board.innings.filter((i) => !i.isSuperOver);
    const second =
      regular.find((i) => i.inningsNumber === 2) ??
      [...regular].reverse().find((i) => i.status === CricketInningsStatus.COMPLETED);
    const superDone = board.innings.filter(
      (i) => i.isSuperOver && i.status === CricketInningsStatus.COMPLETED,
    );
    const teamFor = (id: string) => {
      if (standalone) {
        return {
          id,
          players: id === 'home' ? (board.homeRoster ?? []) : (board.awayRoster ?? []),
        };
      }
      if (!match) return { id, players: [] };
      return id === match.homeTeamId ? match.homeTeam : match.awayTeam;
    };
    if (superDone.length >= 1) {
      const firstSo = superDone[0]!;
      return {
        battingTeamId: firstSo.bowlingTeamId,
        bowlingTeamId: firstSo.battingTeamId,
        battingTeam: teamFor(firstSo.bowlingTeamId),
        bowlingTeam: teamFor(firstSo.battingTeamId),
      };
    }
    if (second) {
      return {
        battingTeamId: second.battingTeamId,
        bowlingTeamId: second.bowlingTeamId,
        battingTeam: teamFor(second.battingTeamId),
        bowlingTeam: teamFor(second.bowlingTeamId),
      };
    }
    return null;
  }, [board, match, standalone]);

  function recordRuns(runsOffBat: number) {
    ballMut.mutate({ runsOffBat, extraType: 'NONE', extraRuns: 0, isWicket: false });
  }

  function recordExtra(
    extraType: 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE',
    extraRuns: number,
    runsOffBat = 0,
  ) {
    ballMut.mutate({ runsOffBat, extraType, extraRuns, isWicket: false });
  }

  async function recordWicket() {
    if (!dismissedId) {
      setError('Select dismissed batsman');
      return;
    }
    const incomingId = newBatsmanId;
    if (!lastManStanding && !incomingId) {
      setError('Select the incoming batsman');
      return;
    }

    setWicketPending(true);
    setError('');
    try {
      const data = await ballMut.mutateAsync({
        runsOffBat: 0,
        extraType: 'NONE',
        extraRuns: 0,
        isWicket: wicketType !== 'RETIRED_HURT',
        wicketType,
        dismissedPlayerId: dismissedId,
        fielderId: fielderId || undefined,
      });
      qc.setQueryData(boardKey, data);

      const inn = data.innings.find(
        (i) => i.status === CricketInningsStatus.IN_PROGRESS,
      );
      const needsReplacement =
        !!inn &&
        inn.wickets < maxWickets - 1 &&
        (!inn.strikerId || !inn.nonStrikerId);

      if (needsReplacement && incomingId) {
        const body = !inn.strikerId
          ? { strikerId: incomingId }
          : { nonStrikerId: incomingId };
        const updated = await batsmenMut.mutateAsync(body);
        qc.setQueryData(boardKey, updated);
      }

      setWicketOpen(false);
      setNewBatsmanId('');
      setDismissedId('');
      setFielderId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record wicket');
    } finally {
      setWicketPending(false);
    }
  }

  function confirmNewBatsman() {
    if (!newBatsmanId) {
      setError('Select incoming batsman');
      return;
    }
    if (needsStriker) {
      batsmenMut.mutate({ strikerId: newBatsmanId });
    } else if (needsNonStriker) {
      batsmenMut.mutate({ nonStrikerId: newBatsmanId });
    }
  }

  if (isLoading) {
    return <p className="text-[var(--color-muted)]">Loading scoreboard…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Cricket scoreboard</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {standalone
              ? `${board?.homeTeamName} vs ${board?.awayTeamName}`
              : `${match!.homeTeam?.name} vs ${match!.awayTeam?.name}`}
            {board?.matchSummary.result ? ` · ${board.matchSummary.result}` : ''}
          </p>
          {board?.configured && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {CRICKET_FORMAT_PRESETS[board.format ?? 'T20']?.label ?? board.format ?? 'Match'}
              {' · '}
              {board.maxOvers <= 0 ? 'unlimited overs' : `${board.maxOvers} overs`}
              {' · '}
              {board.ballsPerOver} balls/over
              {board.maxOversPerBowler < 100
                ? ` · max ${board.maxOversPerBowler} overs/bowler (${board.maxBowlersAtLimit} at full quota)`
                : ''}
              {board.followOn?.enforced ? ' · follow-on enforced' : ''}
            </p>
          )}
          {board?.matchSummary.homePoints != null && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Points {board.matchSummary.homePoints}–{board.matchSummary.awayPoints}
              {board.matchSummary.homeNetRunRate != null &&
                ` · NRR ${board.matchSummary.homeNetRunRate} / ${board.matchSummary.awayNetRunRate}`}
            </p>
          )}
        </div>
        {activeInnings && (
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-6 py-4 text-center">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              {activeInnings.isSuperOver ? 'Super Over' : `Innings ${activeInnings.inningsNumber}`} · {activeInnings.battingTeamName}
              {activeInnings.isAllOut && ' · ALL OUT'}
              {activeInnings.declared && ' · DECLARED'}
              {activeInnings.endReason === 'RAIN_DLS' && ' · DLS'}
            </p>
            <p className="font-display text-4xl font-bold tabular-nums">
              {activeInnings.runs}/{activeInnings.wickets}
            </p>
            {board?.powerplay?.active && (
              <p className="text-xs font-semibold text-amber-700">
                Powerplay · {board.powerplay.ballsUsed}/{board.powerplay.ballsTotal} balls
              </p>
            )}
            <p className="font-mono text-sm text-[var(--color-muted)]">
              ({activeInnings.oversDisplay}
              {inningsMaxOvers > 0 ? `/${inningsMaxOvers}` : ''} ov) · RR {activeInnings.runRate}
              {activeInnings.requiredRunRate != null &&
                ` · RRR ${activeInnings.requiredRunRate}`}
              {activeInnings.targetRuns != null &&
                ` · Target ${activeInnings.targetRuns}`}
              {activeInnings.projectedScore != null &&
                ` · Proj ${activeInnings.projectedScore}`}
            </p>
            {canEdit && (
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                <span className="text-[var(--color-accent)]">*</span>{' '}
                {playerName(activeInnings.strikerId) ?? '—'}
                {activeInnings.nonStrikerId && (
                  <>
                    {' · '}
                    {playerName(activeInnings.nonStrikerId)}
                  </>
                )}
                {!activeInnings.nonStrikerId && !lastManStanding && (
                  <span className="text-amber-700"> · new batsman needed</span>
                )}
                {needsBowlerChange && (
                  <span className="text-sky-700"> · over complete — new bowler</span>
                )}
                {isManualStrike && (
                  <span className="ml-1 text-[var(--color-muted)]"> · manual strike</span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {board?.toss && (
        <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm">
          <span className="font-semibold">{board.toss.winnerTeamName}</span> won the toss
          and elected to{' '}
          <span className="font-semibold">
            {board.toss.decision === 'BAT' ? 'bat' : 'bowl'}
          </span>
          .
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {needsSquads && (
        <section className="gaming-card rounded-xl border-amber-500/40 p-5 space-y-3">
          <h3 className="font-display font-bold text-amber-800 dark:text-amber-200">
            Add players to both teams
          </h3>
          <p className="text-sm text-[var(--color-muted)]">
            {!homeHasPlayers && !awayHasPlayers
              ? 'Neither team has players yet. Add a default squad before starting the innings.'
              : !homeHasPlayers
                ? `${match?.homeTeam?.name ?? 'Home team'} has no players.`
                : `${match?.awayTeam?.name ?? 'Away team'} has no players.`}
          </p>
          <Button
            onClick={() => ensureSquadsMut.mutate()}
            disabled={ensureSquadsMut.isPending}
          >
            {ensureSquadsMut.isPending ? 'Adding…' : 'Add default squad (11 players per team)'}
          </Button>
        </section>
      )}

      {canEdit && enableToss && !activeInnings && !matchScoringStarted && (
        <section className="gaming-card rounded-xl border border-[var(--color-accent)]/30 p-5 space-y-4">
          <h3 className="font-display font-bold">Toss</h3>
          {board?.toss ? (
            <CricketCoinToss
              homeName={
                standalone
                  ? (board.homeTeamName ?? 'Home')
                  : (match!.homeTeam?.name ?? 'Home')
              }
              awayName={
                standalone
                  ? (board.awayTeamName ?? 'Away')
                  : (match!.awayTeam?.name ?? 'Away')
              }
              homeSide={homeSide}
              awaySide={awaySide}
              onComplete={() => {}}
              recorded={{
                winnerName: board.toss.winnerTeamName,
                decision: board.toss.decision,
              }}
            />
          ) : (
            <>
              <p className="text-sm text-[var(--color-muted)]">
                Pick who calls heads or tails, flip the coin, then choose bat or bowl.
              </p>
              <CricketCoinToss
                homeName={
                  standalone
                    ? (board?.homeTeamName ?? 'Home')
                    : (match!.homeTeam?.name ?? 'Home')
                }
                awayName={
                  standalone
                    ? (board?.awayTeamName ?? 'Away')
                    : (match!.awayTeam?.name ?? 'Away')
                }
                homeSide={homeSide}
                awaySide={awaySide}
                onComplete={(result) => {
                  setTossWinnerId(result.winnerSide);
                  setTossDecision(result.decision);
                }}
                onSave={() => tossMut.mutate()}
                saving={tossMut.isPending}
              />
            </>
          )}
        </section>
      )}

      {canEdit && !activeInnings && !superOverPending && board?.followOn?.available && (
        <section className="gaming-card rounded-xl border-amber-500/40 p-5 space-y-3">
          <h3 className="font-display font-bold">Follow-on available</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Lead of {board.followOn.lead} runs after two innings (ICC margin {board.followOn.margin}).
            Enforce the follow-on so the side batting second bats again.
          </p>
          <Button onClick={() => followOnMut.mutate(true)} disabled={followOnMut.isPending}>
            Enforce follow-on
          </Button>
        </section>
      )}

      {canEdit && !activeInnings && !superOverPending && (
        <section className="gaming-card rounded-xl p-5 space-y-4">
          <h3 className="font-display font-bold">Start innings</h3>
          {!matchScoringStarted && (
            <>
              <p className="text-sm text-[var(--color-muted)]">
                Choose format and overs — used for run rate, projected score, and NRR.
              </p>
              <div className="flex flex-wrap gap-2">
                {SETUP_FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => selectSetupFormat(f)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold ${
                      setupFormat === f
                        ? 'bg-[var(--color-accent)] text-[#041018]'
                        : 'border border-[var(--color-line)]'
                    }`}
                  >
                    {CRICKET_FORMAT_PRESETS[f].label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Innings</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={inningsNum}
                onChange={(e) => setInningsNum(Number(e.target.value))}
              >
                <option value={1}>1st innings</option>
                <option value={2}>2nd innings</option>
                {(board?.inningsCount ?? cricketFormatPreset(setupFormat).inningsCount) >= 3 && (
                  <option value={3}>3rd innings</option>
                )}
                {(board?.inningsCount ?? cricketFormatPreset(setupFormat).inningsCount) >= 4 && (
                  <option value={4}>4th innings</option>
                )}
              </select>
            </div>
            <div>
              <Label>Batting team</Label>
              {standalone ? (
                <select
                  className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                  value={battingSide}
                  onChange={(e) => setBattingSide(e.target.value as 'home' | 'away')}
                >
                  <option value="home">{board?.homeTeamName}</option>
                  <option value="away">{board?.awayTeamName}</option>
                </select>
              ) : (
                <select
                  className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                  value={battingTeamId}
                  onChange={(e) => {
                    setBattingTeamId(e.target.value);
                    setBowlingTeamId(
                      e.target.value === match!.homeTeamId
                        ? match!.awayTeamId ?? ''
                        : match!.homeTeamId ?? '',
                    );
                  }}
                  disabled={enableToss && !!board?.toss && inningsNum === 1}
                >
                  <option value={match!.homeTeamId ?? ''}>{match!.homeTeam?.name}</option>
                  <option value={match!.awayTeamId ?? ''}>{match!.awayTeam?.name}</option>
                </select>
              )}
              {enableToss && board?.toss && inningsNum === 1 && (
                <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                  Set from toss result
                </p>
              )}
            </div>
            {!matchScoringStarted && (
              <>
                <div>
                  <Label>Overs per innings (0 = unlimited)</Label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                    value={customMaxOvers}
                    onChange={(e) => setCustomMaxOvers(e.target.value)}
                    placeholder={setupFormat === 'CUSTOM' ? 'e.g. 8' : '20'}
                  />
                </div>
                <div>
                  <Label>Balls per over</Label>
                  <input
                    type="number"
                    min={4}
                    max={10}
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                    value={customBallsPerOver}
                    onChange={(e) => setCustomBallsPerOver(e.target.value)}
                  />
                </div>
              </>
            )}
            {!matchScoringStarted && (
              <>
                <div>
                  <Label>Max overs per bowler</Label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                    value={maxOversPerBowler}
                    onChange={(e) => setMaxOversPerBowler(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Bowlers allowed at max</Label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                    value={maxBowlersAtLimit}
                    onChange={(e) => setMaxBowlersAtLimit(e.target.value)}
                  />
                </div>
              </>
            )}
            {matchScoringStarted && board?.configured && (
              <div className="sm:col-span-2 text-sm text-[var(--color-muted)]">
                Match limit: {board.maxOvers} overs · {board.ballsPerOver} balls/over
                · max {board.maxOversPerBowler} overs/bowler ({board.maxBowlersAtLimit} at full quota)
              </div>
            )}
            <div>
              <Label>Striker</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={strikerId}
                onChange={(e) => {
                  const v = e.target.value;
                  setStrikerId(v);
                  if (v && v === nonStrikerId) setNonStrikerId('');
                }}
                disabled={needsSquads}
              >
                <option value="">Select…</option>
                {playerOptions(playersForTeam(battingTeam as Team), nonStrikerId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Non-striker</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={nonStrikerId}
                onChange={(e) => {
                  const v = e.target.value;
                  setNonStrikerId(v);
                  if (v && v === strikerId) setStrikerId('');
                }}
                disabled={needsSquads}
              >
                <option value="">Select…</option>
                {playerOptions(playersForTeam(battingTeam as Team), strikerId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Bowler</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={bowlerId}
                onChange={(e) => setBowlerId(e.target.value)}
                disabled={needsSquads}
              >
                <option value="">Select…</option>
                {bowlerOptions(
                  playersForTeam(bowlingTeam as Team),
                  null,
                  false,
                  {},
                  bowlerLimitSettings,
                ).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          {!matchScoringStarted && (
            <p className="text-xs text-[var(--color-muted)]">
              Each bowler up to {maxOversPerBowler} overs; only {maxBowlersAtLimit} may reach
              that limit (others capped at {Math.max(1, Number(maxOversPerBowler) - 1)}).
            </p>
          )}
          {!matchScoringStarted && (
            <div>
              <Label>Strike rotation</Label>
              <div className="mt-2 flex gap-2">
                {(['AUTO', 'MANUAL'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStrikeRotationMode(mode)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold ${
                      strikeRotationMode === mode
                        ? 'bg-[var(--color-accent)] text-[#041018]'
                        : 'border border-[var(--color-line)]'
                    }`}
                  >
                    {mode === 'AUTO' ? 'Auto' : 'Manual'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button
            onClick={() => {
              try {
                buildSetupPayload();
                startMut.mutate();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Invalid match settings');
              }
            }}
            disabled={
              startMut.isPending ||
              needsSquads ||
              !strikerId ||
              !nonStrikerId ||
              !bowlerId ||
              needsToss
            }
          >
            {needsToss ? 'Record toss first' : 'Start innings'}
          </Button>
        </section>
      )}

      {board?.configured && standalone && canEdit && !activeInnings && (
        <section className="gaming-card rounded-xl p-5">
          <h3 className="font-display font-bold">Scoring options</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Strike mode: {(board.strikeRotationMode ?? 'AUTO') === 'AUTO' ? 'Automatic' : 'Manual'}
          </p>
          <div className="mt-3 flex gap-2">
            {(['AUTO', 'MANUAL'] as const).map((mode) => (
              <Button
                key={mode}
                variant={board.strikeRotationMode === mode ? 'primary' : 'secondary'}
                onClick={() =>
                  api(`${apiBase}/setup`, apiOpts('POST', {
                    format: board.format ?? 'T20',
                    strikeRotationMode: mode,
                    maxOvers: board.maxOvers,
                    ballsPerOver: board.ballsPerOver,
                  }))
                    .then(() => qc.invalidateQueries({ queryKey: boardKey }))
                    .catch((e: Error) => setError(e.message))
                }
              >
                {mode === 'AUTO' ? 'Auto strike' : 'Manual strike'}
              </Button>
            ))}
          </div>
        </section>
      )}

      {board?.configured && superOverPending && !activeInnings && canEdit && (
        <section className="gaming-card rounded-xl border-amber-500/40 p-5 space-y-4">
          <h3 className="font-display font-bold text-amber-700">
            Super Over {superInningsDone > 0 ? '— chase innings' : 'required'}
          </h3>
          <p className="text-sm text-[var(--color-muted)]">
            {superInningsDone > 0
              ? 'First Super Over complete. Start the chasing team’s over (1 over, max 2 wickets).'
              : 'Match tied in knockout. Start the Super Over (team that batted second in the main match bats first).'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Striker</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={strikerId}
                onChange={(e) => {
                  const v = e.target.value;
                  setStrikerId(v);
                  if (v && v === nonStrikerId) setNonStrikerId('');
                }}
              >
                <option value="">Select…</option>
                {playerOptions(
                  playersForTeam(superOverTeams?.battingTeam),
                  nonStrikerId,
                ).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Non-striker</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={nonStrikerId}
                onChange={(e) => {
                  const v = e.target.value;
                  setNonStrikerId(v);
                  if (v && v === strikerId) setStrikerId('');
                }}
              >
                <option value="">Select…</option>
                {playerOptions(
                  playersForTeam(superOverTeams?.battingTeam),
                  strikerId,
                ).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Bowler</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={bowlerId}
                onChange={(e) => setBowlerId(e.target.value)}
              >
                <option value="">Select…</option>
                {playersForTeam(superOverTeams?.bowlingTeam).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button
            onClick={() => superOverMut.mutate()}
            disabled={superOverMut.isPending || !strikerId || !nonStrikerId || !bowlerId}
          >
            Start Super Over
          </Button>
        </section>
      )}

      {activeInnings && canEdit && (
        <section className="gaming-card rounded-xl p-5 space-y-4">
          {needsBowlerChange && (
            <div className="rounded-lg border-2 border-sky-500/60 bg-sky-500/15 p-4 space-y-3">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                Over complete — select the next bowler
              </p>
              <p className="text-xs text-sky-800/80 dark:text-sky-200/80">
                {board?.strikeRotationMode === 'AUTO' && activeInnings.nonStrikerId
                  ? `Strike rotated automatically. On strike: ${playerName(activeInnings.strikerId)} · Non-striker: ${playerName(activeInnings.nonStrikerId)}`
                  : 'Pick a different bowler — same bowler cannot bowl consecutive overs, and over limits apply.'}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <Label>Next bowler</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                    value={newBowlerId}
                    onChange={(e) => setNewBowlerId(e.target.value)}
                  >
                    <option value="">Select bowler…</option>
                    {bowlerOptions(
                      activeBowlingRoster,
                      activeInnings.lastOverBowlerId,
                      true,
                      activeBowlingLegalBalls,
                      bowlerLimitSettings,
                    ).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={() => bowlerMut.mutate()}
                  disabled={!newBowlerId || bowlerMut.isPending}
                >
                  Set bowler
                </Button>
              </div>
            </div>
          )}

          {needsNewBatsman && (
            <div className="rounded-lg border-2 border-amber-500/60 bg-amber-500/15 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {needsStriker
                  ? 'Striker missing — pick who faces the next ball'
                  : 'Pick the incoming batsman before the next delivery'}
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                On strike: {playerName(activeInnings.strikerId) ?? 'not set'}
                {!lastManStanding &&
                  ` · Non-striker: ${playerName(activeInnings.nonStrikerId) ?? 'not set'}`}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <Label>{needsStriker ? 'Striker' : 'Incoming batsman'}</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                    value={newBatsmanId}
                    onChange={(e) => setNewBatsmanId(e.target.value)}
                  >
                    <option value="">Select batsman…</option>
                    {availableBatsmen.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {availableBatsmen.length === 0 && (
                    <p className="mt-1 text-xs text-red-700">
                      No available batsmen in the squad.
                    </p>
                  )}
                </div>
                <Button
                  onClick={confirmNewBatsman}
                  disabled={!newBatsmanId || batsmenMut.isPending}
                >
                  Set batsman
                </Button>
              </div>
            </div>
          )}

          <h3 className="font-display font-bold">Ball-by-ball entry</h3>
          {!canRecordBall && needsBowlerChange && (
            <p className="text-sm text-[var(--color-muted)]">
              Over finished — pick the next bowler to continue.
            </p>
          )}
          {!canRecordBall && !needsNewBatsman && !needsBowlerChange && (
            <p className="text-sm text-[var(--color-muted)]">
              Set the bowler before recording deliveries.
            </p>
          )}
          {isManualStrike && activeInnings && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="px-3 py-1 text-xs"
                disabled={!activeInnings.strikerId || !activeInnings.nonStrikerId || swapStrikeMut.isPending}
                onClick={() => swapStrikeMut.mutate()}
              >
                Swap strike
              </Button>
              <span className="self-center text-xs text-[var(--color-muted)]">
                Manual mode — swap striker and non-striker yourself
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 6].map((r) => (
              <Button
                key={r}
                variant="secondary"
                className="min-w-[3rem] font-mono text-lg"
                onClick={() => recordRuns(r)}
                disabled={ballMut.isPending || !canRecordBall}
              >
                {r}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setExtraOpen('WIDE')} disabled={!canRecordBall}>Wide</Button>
            <Button variant="secondary" onClick={() => setExtraOpen('NO_BALL')} disabled={!canRecordBall}>No ball</Button>
            <Button variant="secondary" onClick={() => setExtraOpen('BYE')} disabled={!canRecordBall}>Bye</Button>
            <Button variant="secondary" onClick={() => setExtraOpen('LEG_BYE')} disabled={!canRecordBall}>Leg bye</Button>
            <Button variant="secondary" className="bg-red-500/15 text-red-700" onClick={() => setWicketOpen(true)} disabled={!canRecordBall}>Wicket</Button>
            <Button variant="ghost" onClick={() => undoMut.mutate()} disabled={undoMut.isPending}>
              Undo
            </Button>
            <Button variant="ghost" onClick={() => endMut.mutate('MANUAL')} disabled={endMut.isPending}>
              End innings
            </Button>
            <Button variant="ghost" onClick={() => declareMut.mutate()} disabled={declareMut.isPending}>
              Declare
            </Button>
            {!standalone && match?.status !== 'COMPLETED' && (
              <>
                <Button
                  variant="ghost"
                  className="text-amber-700"
                  onClick={() => {
                    if (confirm('Mark as no result? Both teams get 1 point (league).')) {
                      abandonMut.mutate('NO_RESULT');
                    }
                  }}
                  disabled={abandonMut.isPending}
                >
                  No result
                </Button>
                <Button
                  variant="ghost"
                  className="text-red-700"
                  onClick={() => {
                    if (confirm('Abandon match? Counts as no result in standings.')) {
                      abandonMut.mutate('ABANDONED');
                    }
                  }}
                  disabled={abandonMut.isPending}
                >
                  Abandon
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--color-line)] p-3">
            <p className="w-full text-sm font-semibold">Rain — DLS method</p>
            <div className="flex-1 min-w-[8rem]">
              <Label>Revised overs</Label>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={dlsOvers}
                onChange={(e) => setDlsOvers(e.target.value)}
                placeholder="e.g. 15"
              />
            </div>
            <Button
              variant="secondary"
              disabled={!dlsOvers || dlsMut.isPending}
              onClick={() => dlsMut.mutate()}
            >
              Apply DLS
            </Button>
          </div>

          {extraOpen && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--color-line)] p-3">
              <p className="w-full text-sm font-semibold">{extraOpen.replace('_', ' ')}</p>
              {[0, 1, 2, 3, 4].map((r) => (
                <Button
                  key={r}
                  className="px-3 py-1 text-xs"
                  onClick={() =>
                    recordExtra(extraOpen, extraOpen === 'WIDE' || extraOpen === 'NO_BALL' ? r + 1 : r)
                  }
                >
                  +{extraOpen === 'WIDE' || extraOpen === 'NO_BALL' ? r + 1 : r}
                </Button>
              ))}
              <Button className="px-3 py-1 text-xs" variant="ghost" onClick={() => setExtraOpen(null)}>Cancel</Button>
            </div>
          )}

          {wicketOpen && (
            <div className="grid gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 sm:grid-cols-2">
              <div>
                <Label>Dismissal</Label>
                <select
                  className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                  value={wicketType}
                  onChange={(e) => setWicketType(e.target.value as CricketWicketType)}
                >
                  {['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'RETIRED', 'RETIRED_HURT', 'OBSTRUCTING', 'TIMED_OUT', 'OTHER'].map(
                    (w) => (
                      <option key={w} value={w}>{w.replaceAll('_', ' ')}</option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <Label>Out — who got dismissed?</Label>
                <select
                  className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                  value={dismissedId}
                  onChange={(e) => {
                    setDismissedId(e.target.value);
                    setNewBatsmanId('');
                  }}
                >
                  <option value="">Select…</option>
                  {creaseBatsmen.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {!lastManStanding && (
                <div className="sm:col-span-2">
                  <Label>Incoming batsman (required)</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                    value={newBatsmanId}
                    onChange={(e) => setNewBatsmanId(e.target.value)}
                  >
                    <option value="">Select new batsman…</option>
                    {incomingBatsmenOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {dismissedId && activeInnings?.strikerId === dismissedId
                      ? 'New batsman faces the next ball (striker\'s end).'
                      : dismissedId && activeInnings?.nonStrikerId === dismissedId
                        ? 'New batsman at the non-striker\'s end.'
                        : 'Select who was dismissed first.'}
                  </p>
                </div>
              )}
              <div>
                <Label>Fielder (optional)</Label>
                <select
                  className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                  value={fielderId}
                  onChange={(e) => setFielderId(e.target.value)}
                >
                  <option value="">None</option>
                  {activeBowlingRoster.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={() => void recordWicket()}
                  disabled={wicketPending || ballMut.isPending || batsmenMut.isPending}
                >
                  {wicketPending ? 'Saving…' : 'Confirm wicket'}
                </Button>
                <Button variant="ghost" onClick={() => setWicketOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--color-line)] pt-4">
            <div className="flex-1 min-w-[12rem]">
              <Label>Change bowler</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2"
                value={newBowlerId}
                onChange={(e) => setNewBowlerId(e.target.value)}
              >
                <option value="">Select…</option>
                {bowlerOptions(
                  activeBowlingRoster,
                  activeInnings.lastOverBowlerId,
                  !!activeInnings.overCompletePending,
                  activeBowlingLegalBalls,
                  bowlerLimitSettings,
                ).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              disabled={!newBowlerId || bowlerMut.isPending}
              onClick={() => bowlerMut.mutate()}
            >
              Update bowler
            </Button>
          </div>

          {activeInnings.currentOverBalls.length > 0 && (
            <div>
              <p className="text-xs uppercase text-[var(--color-muted)]">This over</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {activeInnings.currentOverBalls.map((b) => (
                  <span
                    key={b.id}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm ${
                      b.isWicket
                        ? 'bg-red-500/20 text-red-700'
                        : b.totalRuns > 0
                          ? 'bg-[var(--color-accent)]/20'
                          : 'bg-[var(--color-surface)]'
                    }`}
                  >
                    {b.display}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {board?.innings.map((inn) => (
        <section key={inn.id} className="gaming-card rounded-xl p-5 space-y-4">
          <h3 className="font-display font-bold">
            Innings {inn.inningsNumber} — {inn.battingTeamName}{' '}
            <span className="font-mono text-[var(--color-accent)]">
              {inn.runs}/{inn.wickets} ({inn.oversDisplay})
            </span>
            <span className="ml-2 text-sm font-normal text-[var(--color-muted)]">
              RR {inn.runRate}
              {inn.endReason && ` · ${inn.endReason.replaceAll('_', ' ')}`}
            </span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                  <th className="py-2 pr-4">Batsman</th>
                  <th className="py-2 px-2">R</th>
                  <th className="py-2 px-2">B</th>
                  <th className="py-2 px-2">4s</th>
                  <th className="py-2 px-2">6s</th>
                  <th className="py-2 px-2">SR</th>
                  <th className="py-2 px-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {inn.batting.map((b) => (
                  <tr key={b.playerId} className="border-b border-[var(--color-line)]/50">
                    <td className="py-2 pr-4">
                      {b.playerName}
                      {b.isGoldenDuck && (
                        <span className="ml-1 rounded bg-red-500/20 px-1 text-xs text-red-700">golden duck</span>
                      )}
                      {b.isDuck && !b.isGoldenDuck && (
                        <span className="ml-1 rounded bg-amber-500/20 px-1 text-xs text-amber-800">duck</span>
                      )}
                      {b.isOut && b.dismissal && (
                        <span className="block text-xs text-[var(--color-muted)]">{b.dismissal}</span>
                      )}
                      {!b.isOut && b.runs + b.balls > 0 && (
                        <span className="text-xs text-[var(--color-accent)]"> not out</span>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono">{b.runs}</td>
                    <td className="py-2 px-2 font-mono">{b.balls}</td>
                    <td className="py-2 px-2 font-mono">{b.fours}</td>
                    <td className="py-2 px-2 font-mono">{b.sixes}</td>
                    <td className="py-2 px-2 font-mono">{b.strikeRate}</td>
                    <td className="py-2 px-2 font-mono">{b.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                  <th className="py-2 pr-4">Bowler</th>
                  <th className="py-2 px-2">O</th>
                  <th className="py-2 px-2">R</th>
                  <th className="py-2 px-2">W</th>
                  <th className="py-2 px-2">Econ</th>
                  <th className="py-2 px-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {inn.bowling.map((b) => (
                  <tr key={b.playerId} className="border-b border-[var(--color-line)]/50">
                    <td className="py-2 pr-4">{b.playerName}</td>
                    <td className="py-2 px-2 font-mono">{b.overs}</td>
                    <td className="py-2 px-2 font-mono">{b.runs}</td>
                    <td className="py-2 px-2 font-mono">{b.wickets}</td>
                    <td className="py-2 px-2 font-mono">{b.economy}</td>
                    <td className="py-2 px-2 font-mono">{b.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inn.fallOfWickets.length > 0 && (
            <div>
              <p className="text-xs uppercase text-[var(--color-muted)]">Fall of wickets</p>
              <p className="mt-1 text-sm">
                {inn.fallOfWickets.map((f) => (
                  <span key={f.wicket} className="mr-3">
                    {f.score}/{f.wicket} ({f.over}, {f.batsmanName})
                  </span>
                ))}
              </p>
            </div>
          )}

          {inn.recentBalls.length > 0 && (
            <div>
              <p className="text-xs uppercase text-[var(--color-muted)]">Recent balls</p>
              <p className="mt-1 font-mono text-sm">
                {inn.recentBalls.map((b) => b.display).join(' · ')}
              </p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
