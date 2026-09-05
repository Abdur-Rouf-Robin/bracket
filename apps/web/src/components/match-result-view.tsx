'use client';

import type { Match, Team, Tournament } from '@/lib/types';
import { formatSets } from '@bracket/bracket-engine';
import {
  resolveRoundLabel,
  resolveShareCardDisplayMode,
  resolveWinnerSide,
  type ShareCardDisplayMode,
  type ShareCardPayload,
  type TournamentSettings,
} from '@bracket/shared';
import { Crown } from 'lucide-react';
import {
  teamColor,
  teamFromShare,
  teamInitials,
} from '@/lib/team-display';

export type MatchResultData = {
  tournamentName?: string;
  gameName?: string | null;
  format?: string | null;
  round: number;
  bracketSide: string;
  roundLabel?: string;
  allowPercent?: boolean;
  displayMode?: ShareCardDisplayMode;
  home: {
    id?: string | null;
    name: string;
    score: number | null;
    percent?: number | null;
    poolColor?: string | null;
    seed?: number | null;
    isWinner?: boolean;
    /** Cricket — formatted innings e.g. `245/8 (20.0)` */
    scoreLabel?: string | null;
  };
  away: {
    id?: string | null;
    name: string;
    score: number | null;
    percent?: number | null;
    poolColor?: string | null;
    seed?: number | null;
    isWinner?: boolean;
    scoreLabel?: string | null;
  };
  winner?: string | null;
  winnerSide?: 'home' | 'away' | 'draw' | null;
  isDraw?: boolean;
  isForfeit?: boolean;
  bestOf?: number | null;
  legNumber?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  scoreMargin?: number | null;
  percentMargin?: number | null;
  totalScore?: number | null;
  status?: string;
  setsLine?: string | null;
  mvp?: {
    playerName: string;
    teamName: string;
    mvpScore: number;
    goals: number;
    assists: number;
    points: number;
    kills: number;
    deaths: number;
    rating: number | null;
  } | null;
};

function normalizeData(
  data: MatchResultData | ShareCardPayload,
): MatchResultData & { displayMode: ShareCardDisplayMode } {
  const mvpFromShare =
    'mvp' in data && data.mvp
      ? {
          playerName: data.mvp.playerName,
          teamName: data.mvp.teamName,
          mvpScore: data.mvp.mvpScore,
          goals: 'stats' in data.mvp ? data.mvp.stats.goals : 0,
          assists: 'stats' in data.mvp ? data.mvp.stats.assists : 0,
          points: 'stats' in data.mvp ? data.mvp.stats.points : 0,
          kills: 'stats' in data.mvp ? data.mvp.stats.kills : 0,
          deaths: 'stats' in data.mvp ? data.mvp.stats.deaths : 0,
          rating: 'stats' in data.mvp ? data.mvp.stats.rating : null,
        }
      : (data as MatchResultData).mvp ?? null;

  if ('displayMode' in data && data.displayMode) {
    return {
      ...(data as MatchResultData),
      displayMode: data.displayMode,
      mvp: mvpFromShare,
    };
  }

  const allowPercent = data.allowPercent ?? false;
  const displayMode =
    resolveShareCardDisplayMode(
      allowPercent,
      data.home.score,
      data.away.score,
      data.home.percent,
      data.away.percent,
    );

  const winnerSide =
    data.winnerSide ??
    resolveWinnerSide(
      data.isDraw ?? false,
      data.home.isWinner
        ? data.home.id ?? 'home'
        : data.away.isWinner
          ? data.away.id ?? 'away'
          : null,
      data.home.id ?? null,
      data.away.id ?? null,
    );

  const homeScore = data.home.score ?? 0;
  const awayScore = data.away.score ?? 0;

  return {
    ...data,
    displayMode,
    mvp: mvpFromShare,
    winnerSide,
    home: {
      ...data.home,
      isWinner: data.home.isWinner ?? winnerSide === 'home',
    },
    away: {
      ...data.away,
      isWinner: data.away.isWinner ?? winnerSide === 'away',
    },
    scoreMargin:
      data.scoreMargin ??
      (data.home.score != null && data.away.score != null
        ? homeScore - awayScore
        : null),
    percentMargin:
      data.percentMargin ??
      (data.home.percent != null && data.away.percent != null
        ? data.home.percent - data.away.percent
        : null),
    totalScore:
      data.totalScore ??
      (data.home.score != null && data.away.score != null
        ? homeScore + awayScore
        : null),
  };
}

function cricketInningsLabel(
  meta: Match['matchMeta'],
  teamId: string | null | undefined,
): string | null {
  const report = meta?.cricketReport;
  if (!report || !teamId) return null;
  const inn = report.innings.find((i) => i.battingTeamId === teamId);
  if (!inn) return null;
  return `${inn.runs}/${inn.wickets} (${inn.overs})`;
}

export function matchToResultData(
  m: Match,
  tournament: Pick<Tournament, 'name' | 'format' | 'allowPercent' | 'game' | 'settings'> & {
    matches?: Match[];
  },
): MatchResultData {
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const koMatches = tournament.matches?.filter(
    (x) => x.bracketSide !== 'GROUP' && x.bracketSide !== 'SWISS',
  );
  const totalRounds = koMatches?.length
    ? Math.max(...koMatches.map((x) => x.round))
    : undefined;
  const bestOf =
    (m.bestOf ?? settings.knockoutBestOf ?? 1) > 1
      ? (m.bestOf ?? settings.knockoutBestOf ?? 1)
      : null;

  const winnerSide = resolveWinnerSide(
    m.isDraw,
    m.winnerTeamId,
    m.homeTeamId,
    m.awayTeamId,
  );

  return {
    tournamentName: tournament.name,
    gameName: tournament.game?.name ?? null,
    format: tournament.format,
    round: m.round,
    bracketSide: m.bracketSide,
    roundLabel: resolveRoundLabel(m.round, settings, totalRounds),
    allowPercent: tournament.allowPercent,
    status: m.status,
    home: {
      id: m.homeTeamId,
      name: m.homeTeam?.name ?? 'TBD',
      score: m.homeScore,
      percent: m.homePercent,
      poolColor: m.homeTeam?.poolColor ?? null,
      seed: m.homeTeam?.seed ?? null,
      isWinner: winnerSide === 'home',
      scoreLabel: cricketInningsLabel(m.matchMeta, m.homeTeamId),
    },
    away: {
      id: m.awayTeamId,
      name: m.awayTeam?.name ?? 'TBD',
      score: m.awayScore,
      percent: m.awayPercent,
      poolColor: m.awayTeam?.poolColor ?? null,
      seed: m.awayTeam?.seed ?? null,
      isWinner: winnerSide === 'away',
      scoreLabel: cricketInningsLabel(m.matchMeta, m.awayTeamId),
    },
    isDraw: m.isDraw,
    isForfeit: m.isForfeit ?? false,
    setsLine: formatSets(m.sets) || null,
    bestOf,
    legNumber: m.legNumber ?? null,
    attachmentUrl:
      settings.allowMatchAttachments ? m.attachmentUrl ?? null : null,
    attachmentName:
      settings.allowMatchAttachments ? m.attachmentName ?? null : null,
    winnerSide,
    winner:
      m.isDraw
        ? 'Draw'
        : m.winnerTeam?.name ??
          (winnerSide === 'home'
            ? m.homeTeam?.name
            : winnerSide === 'away'
              ? m.awayTeam?.name
              : null),
    mvp: m.mvpPlayer
      ? {
          playerName: m.mvpPlayer.name,
          teamName:
            m.playerStats?.find((s) => s.playerId === m.mvpPlayer?.id)?.team
              ?.name ??
            m.homeTeamId === m.mvpPlayer.teamId
              ? m.homeTeam?.name ?? ''
              : m.awayTeam?.name ?? '',
          mvpScore:
            m.playerStats?.find((s) => s.isMvp)?.mvpScore ??
            m.playerStats?.find((s) => s.playerId === m.mvpPlayer?.id)
              ?.mvpScore ??
            0,
          goals:
            m.playerStats?.find((s) => s.playerId === m.mvpPlayer?.id)?.goals ??
            0,
          assists:
            m.playerStats?.find((s) => s.playerId === m.mvpPlayer?.id)
              ?.assists ?? 0,
          points:
            m.playerStats?.find((s) => s.playerId === m.mvpPlayer?.id)?.points ??
            0,
          kills:
            m.playerStats?.find((s) => s.playerId === m.mvpPlayer?.id)?.kills ??
            0,
          deaths:
            m.playerStats?.find((s) => s.playerId === m.mvpPlayer?.id)?.deaths ??
            0,
          rating:
            m.playerStats?.find((s) => s.playerId === m.mvpPlayer?.id)?.rating ??
            null,
        }
      : null,
  };
}

function TeamLogo({
  team,
  name,
  poolColor,
  size = 'lg',
  faded = false,
}: {
  team?: Team | null;
  name: string;
  poolColor?: string | null;
  size?: 'md' | 'lg' | 'xl' | 'hero';
  faded?: boolean;
}) {
  const t = team ?? { id: '', name, seed: null, groupId: null, poolColor: poolColor ?? null };
  const bg = teamColor(t);
  const dim =
    size === 'hero'
      ? 'size-32 text-4xl'
      : size === 'xl'
        ? 'size-20 text-2xl'
        : size === 'lg'
          ? 'size-16 text-xl'
          : 'size-12 text-base';

  return (
    <div
      className={`${dim} flex items-center justify-center rounded-2xl border-2 font-display font-bold text-white shadow-lg ${
        faded ? 'opacity-20' : 'opacity-100'
      }`}
      style={{
        backgroundColor: bg,
        borderColor: `${bg}88`,
        boxShadow: faded ? 'none' : `0 8px 32px ${bg}44`,
      }}
    >
      {teamInitials(name)}
    </div>
  );
}

function MatchAttachmentLink({
  url,
  name,
  variant,
}: {
  url: string;
  name?: string | null;
  variant: 'compact' | 'card';
}) {
  if (variant === 'compact') {
    return (
      <p className="mt-2 border-t border-[var(--color-line)] pt-2 text-xs">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] underline"
        >
          {name ?? 'Match attachment'}
        </a>
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4 text-center">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-sky-300 underline"
      >
        {name ?? 'Match attachment'}
      </a>
    </div>
  );
}

function WinnerBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
      <Crown className="size-3" />
      Winner
    </span>
  );
}

function formatTeamScore(team: {
  score: number | null;
  scoreLabel?: string | null;
}): string | number {
  return team.scoreLabel ?? team.score ?? '—';
}

function ScoreBlock({
  data,
  compact,
}: {
  data: MatchResultData & { displayMode: ShareCardDisplayMode };
  compact?: boolean;
}) {
  const { home, away, displayMode, isDraw, scoreMargin, percentMargin, totalScore } = data;

  return (
    <div className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
      {(displayMode === 'score' || displayMode === 'both') && (
        <div className="flex items-center justify-center gap-4">
          <span
            className={`font-display tabular-nums ${
              compact ? 'text-3xl' : 'text-5xl'
            } font-bold ${home.isWinner ? 'text-emerald-400' : 'text-white/90'}`}
          >
            {formatTeamScore(home)}
          </span>
          <span className="text-lg font-light text-white/40">:</span>
          <span
            className={`font-display tabular-nums ${
              compact ? 'text-3xl' : 'text-5xl'
            } font-bold ${away.isWinner ? 'text-emerald-400' : 'text-white/90'}`}
          >
            {formatTeamScore(away)}
          </span>
        </div>
      )}

      {data.setsLine && (
        <p
          className={`text-center font-medium tabular-nums text-white/60 ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {data.setsLine}
        </p>
      )}

      {(displayMode === 'percent' || displayMode === 'both') && (
        <div className="space-y-2 px-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full transition-all"
              style={{
                width: `${home.percent ?? 50}%`,
                backgroundColor: teamColor(teamFromShare(home)),
              }}
            />
            <div
              className="h-full transition-all"
              style={{
                width: `${away.percent ?? 50}%`,
                backgroundColor: teamColor(teamFromShare(away)),
              }}
            />
          </div>
          <div className="flex justify-between text-xs font-semibold tabular-nums">
            <span style={{ color: teamColor(teamFromShare(home)) }}>
              {home.percent != null ? `${home.percent}%` : '—'}
            </span>
            <span className="text-white/50">Vote share</span>
            <span style={{ color: teamColor(teamFromShare(away)) }}>
              {away.percent != null ? `${away.percent}%` : '—'}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/55">
        {isDraw && (
          <span className="rounded-full bg-white/10 px-3 py-1 font-bold uppercase tracking-wider text-white/80">
            Draw
          </span>
        )}
        {!isDraw && displayMode !== 'percent' && scoreMargin != null && scoreMargin !== 0 && (
          <span>
            Margin:{' '}
            <strong className="text-white/80">
              {scoreMargin > 0 ? '+' : ''}
              {scoreMargin}
            </strong>
          </span>
        )}
        {!isDraw && displayMode !== 'score' && percentMargin != null && percentMargin !== 0 && (
          <span>
            % lead:{' '}
            <strong className="text-white/80">
              {percentMargin > 0 ? '+' : ''}
              {percentMargin}%
            </strong>
          </span>
        )}
        {totalScore != null && displayMode === 'both' && (
          <span>
            Combined: <strong className="text-white/80">{totalScore}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

function TeamColumn({
  side,
  align,
  compact,
  hideSeeds,
}: {
  side: MatchResultData['home'];
  align: 'left' | 'right';
  compact?: boolean;
  hideSeeds?: boolean;
}) {
  const team = teamFromShare(side);
  const color = teamColor(team);

  return (
    <div
      className={`flex flex-1 flex-col gap-2 ${
        align === 'left' ? 'items-start text-left' : 'items-end text-right'
      } ${side.isWinner ? '' : 'opacity-80'}`}
    >
      <TeamLogo
        team={team}
        name={side.name}
        poolColor={side.poolColor}
        size={compact ? 'md' : 'xl'}
      />
      <div className={align === 'left' ? 'items-start' : 'items-end'}>
        <p
          className={`font-display font-bold leading-tight text-white ${
            compact ? 'text-sm' : 'text-lg'
          } ${side.isWinner ? 'text-emerald-300' : ''}`}
        >
          {side.name}
        </p>
        {side.seed != null && !hideSeeds && (
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            Seed #{side.seed}
          </p>
        )}
        {side.isWinner && (
          <div className={`mt-1 ${align === 'right' ? 'flex justify-end' : ''}`}>
            <WinnerBadge />
          </div>
        )}
      </div>
      <div
        className="h-1 w-full max-w-[120px] rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export function MatchResultView({
  data: raw,
  variant = 'card',
  exportId,
  className = '',
  hideSeeds = false,
}: {
  data: MatchResultData | ShareCardPayload;
  variant?: 'card' | 'compact' | 'share';
  exportId?: string;
  className?: string;
  hideSeeds?: boolean;
}) {
  const data = normalizeData(raw);
  const homeColor = teamColor(teamFromShare(data.home));
  const awayColor = teamColor(teamFromShare(data.away));
  const isShare = variant === 'share';
  const isCompact = variant === 'compact';

  const meta = [
    data.gameName,
    data.format?.replaceAll('_', ' '),
    data.roundLabel ?? `Round ${data.round}`,
    data.bracketSide.replaceAll('_', ' '),
  ]
    .filter(Boolean)
    .join(' · ');

  if (isCompact) {
    const showScore = data.displayMode !== 'percent';
    const showPercent = data.displayMode !== 'score';

    return (
      <>
      <div
        className={`flex items-stretch gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-2 ${className}`}
      >
        <div
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 ${
            data.home.isWinner ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : ''
          }`}
        >
          <TeamLogo team={teamFromShare(data.home)} name={data.home.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.home.name}</p>
            {data.home.isWinner && <WinnerBadge />}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center px-1 text-center">
          {showScore && (
            <p className="font-display text-sm font-bold tabular-nums leading-tight">
              {formatTeamScore(data.home)}
              <span className="mx-1 text-[var(--color-muted)]">–</span>
              {formatTeamScore(data.away)}
            </p>
          )}
          {data.setsLine && (
            <p className="text-[10px] font-medium tabular-nums text-[var(--color-muted)]">
              {data.setsLine}
            </p>
          )}
          {showPercent && (
            <p className="text-[10px] font-semibold tabular-nums text-[var(--color-muted)]">
              {data.home.percent ?? '—'}% / {data.away.percent ?? '—'}%
            </p>
          )}
          {data.isDraw && (
            <span className="text-[10px] font-bold uppercase text-[var(--color-muted)]">
              Draw
            </span>
          )}
          {data.isForfeit && (
            <span className="text-[10px] font-bold uppercase text-amber-700">
              Walkover
            </span>
          )}
          {data.legNumber === 1 && (
            <span className="text-[10px] font-semibold text-[var(--color-muted)]">
              Leg 1
            </span>
          )}
          {data.legNumber === 2 && (
            <span className="text-[10px] font-semibold text-[var(--color-muted)]">
              Leg 2
            </span>
          )}
          {data.bestOf != null && data.bestOf > 1 && (
            <span className="text-[10px] font-semibold text-indigo-700">
              Bo{data.bestOf}
            </span>
          )}
        </div>

        <div
          className={`flex min-w-0 flex-1 items-center justify-end gap-2 rounded-lg px-2 py-1.5 ${
            data.away.isWinner ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : ''
          }`}
        >
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold">{data.away.name}</p>
            {data.away.isWinner && (
              <div className="flex justify-end">
                <WinnerBadge />
              </div>
            )}
          </div>
          <TeamLogo team={teamFromShare(data.away)} name={data.away.name} size="md" />
        </div>
      </div>
      {data.attachmentUrl && (
        <MatchAttachmentLink
          url={data.attachmentUrl}
          name={data.attachmentName}
          variant="compact"
        />
      )}
      </>
    );
  }

  return (
    <div
      id={exportId}
      className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`}
      style={{
        background: `linear-gradient(135deg, #0a0c10 0%, #12151c 50%, #0a0c10 100%)`,
      }}
    >
      {/* Background team logos */}
      <div
        className="pointer-events-none absolute -left-8 top-1/2 -translate-y-1/2 opacity-[0.07]"
        aria-hidden
      >
        <TeamLogo
          team={teamFromShare(data.home)}
          name={data.home.name}
          size="hero"
          faded
        />
      </div>
      <div
        className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 opacity-[0.07]"
        aria-hidden
      >
        <TeamLogo
          team={teamFromShare(data.away)}
          name={data.away.name}
          size="hero"
          faded
        />
      </div>

      {/* Color washes */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2"
        style={{
          background: `linear-gradient(90deg, ${homeColor}28 0%, transparent 70%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{
          background: `linear-gradient(-90deg, ${awayColor}28 0%, transparent 70%)`,
        }}
      />

      <div className={`relative ${isShare ? 'p-8' : 'p-5'}`}>
        <div className="text-center">
          {data.tournamentName && (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">
              {data.tournamentName}
            </p>
          )}
          <p className="mt-1 text-xs text-white/50">{meta}</p>
        </div>

        <div className={`mt-6 flex items-center gap-4 ${isShare ? 'gap-8' : ''}`}>
          <TeamColumn side={data.home} align="left" compact={!isShare} hideSeeds={hideSeeds} />
          <div className="flex shrink-0 flex-col items-center justify-center px-2">
            <span className="font-display text-xs font-bold uppercase tracking-widest text-white/30">
              VS
            </span>
            <div className="mt-3 w-full min-w-[140px]">
              <ScoreBlock data={data} compact={!isShare} />
            </div>
          </div>
          <TeamColumn side={data.away} align="right" compact={!isShare} hideSeeds={hideSeeds} />
        </div>

        {!data.isDraw && data.winner && (
          <div className="mt-5 border-t border-white/10 pt-4 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Match result
            </p>
            <p className="font-display text-lg font-bold text-amber-300">
              {data.winner} wins
            </p>
          </div>
        )}

        {data.mvp && (
          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80">
              Player of the Match
            </p>
            <p className="font-display text-xl font-bold text-amber-200">
              {data.mvp.playerName}
            </p>
            <p className="text-xs text-white/50">{data.mvp.teamName}</p>
            <p className="mt-2 text-[11px] tabular-nums text-white/60">
              MVP {data.mvp.mvpScore}
              {(data.mvp.goals > 0 || data.mvp.assists > 0) &&
                ` · ${data.mvp.goals}G ${data.mvp.assists}A`}
              {(data.mvp.kills > 0 || data.mvp.deaths > 0) &&
                ` · ${data.mvp.kills}K/${data.mvp.deaths}D`}
              {data.mvp.rating != null && ` · ${data.mvp.rating} rating`}
            </p>
          </div>
        )}

        {data.attachmentUrl && (
          <MatchAttachmentLink
            url={data.attachmentUrl}
            name={data.attachmentName}
            variant="card"
          />
        )}
      </div>
    </div>
  );
}

export async function downloadResultPng(
  elementId: string,
  filename: string,
): Promise<void> {
  const { downloadElementPng } = await import('@/lib/export-png');
  return downloadElementPng(elementId, filename);
}
