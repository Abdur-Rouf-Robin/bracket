import {
  aggregateTeamRuns,
  computeBattingPoints,
  computeBowlingPoints,
  computeLeaguePoints,
  computeNetRunRate,
  computeProjectedScore,
  computeRequiredRunRate,
  computeRunRate,
  cricketFollowOnState,
  dismissalCountsAsWicket,
  formatCricketOvers,
  lastCompletedOverBowlerId,
  isDuck,
  isGoldenDuck,
  powerplayLegalBalls,
  type CricketBallEvent,
  type CricketBattingRow,
  type CricketBowlingRow,
  type CricketFallOfWicket,
  type CricketInningsEndReason,
  type CricketInningsStatus,
  type CricketInningsView,
  type CricketScoreboard,
} from '@bracket/shared';

type InningsRow = {
  id: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  targetRuns: number | null;
  status: string;
  endReason: string | null;
  isAllOut: boolean;
  isSuperOver: boolean;
  declared: boolean;
  revisedMaxOvers: number | null;
  dlsParScore: number | null;
  strikerId: string | null;
  nonStrikerId: string | null;
  currentBowlerId: string | null;
  balls: Array<{
    id: string;
    sequence: number;
    overNumber: number;
    ballInOver: number;
    batsmanId: string;
    bowlerId: string;
    runsOffBat: number;
    extraType: string;
    extraRuns: number;
    totalRuns: number;
    isLegalDelivery: boolean;
    isWicket: boolean;
    wicketType: string | null;
    dismissedPlayerId: string | null;
    fielderId: string | null;
    commentary: string | null;
  }>;
};

type CricketRow = {
  id: string;
  mode: string;
  matchId: string | null;
  slug: string | null;
  title: string | null;
  format: string | null;
  maxOvers: number;
  maxWickets: number;
  ballsPerOver: number;
  maxOversPerBowler: number;
  maxBowlersAtLimit: number;
  inningsCount: number;
  followOnEnforced?: boolean;
  followOnMargin?: number | null;
  strikeRotationMode?: string;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeRoster?: unknown;
  awayRoster?: unknown;
  homePoints: number | null;
  awayPoints: number | null;
  superOverPending?: boolean;
  innings: InningsRow[];
};

export function formatDismissal(
  ball: {
    wicketType: string | null;
    bowlerId: string;
    fielderId: string | null;
  },
  playerMap: Map<string, string>,
): string {
  const bowler = playerMap.get(ball.bowlerId) ?? 'bowler';
  const fielder = ball.fielderId
    ? (playerMap.get(ball.fielderId) ?? 'fielder')
    : null;
  switch (ball.wicketType) {
    case 'CAUGHT':
      return fielder ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`;
    case 'BOWLED':
      return `b ${bowler}`;
    case 'LBW':
      return `lbw b ${bowler}`;
    case 'RUN_OUT':
      return fielder ? `run out (${fielder})` : 'run out';
    case 'STUMPED':
      return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case 'HIT_WICKET':
      return `hit wicket b ${bowler}`;
    case 'RETIRED':
      return 'retired out';
    case 'RETIRED_HURT':
      return 'retired hurt';
    case 'OBSTRUCTING':
      return 'obstructing the field';
    case 'TIMED_OUT':
      return 'timed out';
    default:
      return ball.wicketType?.replaceAll('_', ' ').toLowerCase() ?? 'out';
  }
}

function ballDisplay(b: {
  runsOffBat: number;
  extraType: string;
  extraRuns: number;
  totalRuns: number;
  isWicket: boolean;
}): string {
  if (b.isWicket) return 'W';
  if (b.extraType === 'WIDE') return b.extraRuns > 1 ? `Wd+${b.extraRuns - 1}` : 'Wd';
  if (b.extraType === 'NO_BALL') {
    if (b.runsOffBat > 0) return `Nb+${b.runsOffBat}`;
    return b.extraRuns > 1 ? `Nb+${b.extraRuns - 1}` : 'Nb';
  }
  if (b.extraType === 'BYE') return `B${b.extraRuns || ''}`;
  if (b.extraType === 'LEG_BYE') return `Lb${b.extraRuns || ''}`;
  return String(b.runsOffBat);
}

export function buildInningsView(
  inn: InningsRow,
  teamMap: Map<string, string>,
  playerMap: Map<string, string>,
  ballsPerOver: number,
  maxOvers: number,
  maxWicketsForInnings: number,
): CricketInningsView {
  const effectiveMax = inn.revisedMaxOvers ?? maxOvers;
  const battingStats = new Map<
    string,
    {
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      isOut: boolean;
      dismissal: string | null;
    }
  >();
  const bowlingStats = new Map<
    string,
    { legalBalls: number; runs: number; wickets: number; overRuns: Map<number, number> }
  >();
  const fallOfWickets: CricketFallOfWicket[] = [];
  let runningScore = 0;
  let wicketCount = 0;

  for (const ball of inn.balls) {
    runningScore += ball.totalRuns;

    const bat = battingStats.get(ball.batsmanId) ?? {
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      dismissal: null,
    };
    if (ball.isLegalDelivery) bat.balls += 1;
    bat.runs += ball.runsOffBat;
    if (ball.runsOffBat === 4) bat.fours += 1;
    if (ball.runsOffBat === 6) bat.sixes += 1;

    if (ball.dismissedPlayerId && (ball.isWicket || ball.wicketType === 'RETIRED_HURT')) {
      const counts = dismissalCountsAsWicket(ball.wicketType, ball.isWicket);
      const dismissed = battingStats.get(ball.dismissedPlayerId) ?? {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        dismissal: null,
      };
      dismissed.isOut = counts;
      dismissed.dismissal = formatDismissal(ball, playerMap);
      battingStats.set(ball.dismissedPlayerId, dismissed);

      if (counts) {
        wicketCount += 1;
        fallOfWickets.push({
          wicket: wicketCount,
          score: runningScore,
          over: formatCricketOvers(
            inn.balls.filter((b) => b.sequence <= ball.sequence && b.isLegalDelivery).length,
            ballsPerOver,
          ),
          batsmanName: playerMap.get(ball.dismissedPlayerId) ?? 'Unknown',
          dismissal: dismissed.dismissal,
        });
      }
    }
    battingStats.set(ball.batsmanId, bat);

    const bowl = bowlingStats.get(ball.bowlerId) ?? {
      legalBalls: 0,
      runs: 0,
      wickets: 0,
      overRuns: new Map<number, number>(),
    };
    if (ball.isLegalDelivery) bowl.legalBalls += 1;
    bowl.runs += ball.totalRuns;
    if (dismissalCountsAsWicket(ball.wicketType, ball.isWicket)) bowl.wickets += 1;
    bowl.overRuns.set(
      ball.overNumber,
      (bowl.overRuns.get(ball.overNumber) ?? 0) + ball.totalRuns,
    );
    bowlingStats.set(ball.bowlerId, bowl);
  }

  const batting: CricketBattingRow[] = [...battingStats.entries()].map(
    ([playerId, s]) => {
      const duck = isDuck(s.runs, s.isOut);
      const golden = isGoldenDuck(s.runs, s.balls, s.isOut);
      return {
        playerId,
        playerName: playerMap.get(playerId) ?? 'Unknown',
        runs: s.runs,
        balls: s.balls,
        fours: s.fours,
        sixes: s.sixes,
        strikeRate: s.balls > 0 ? Math.round((s.runs / s.balls) * 1000) / 10 : 0,
        isOut: s.isOut,
        isDuck: duck,
        isGoldenDuck: golden,
        points: computeBattingPoints({
          runs: s.runs,
          fours: s.fours,
          sixes: s.sixes,
          isDuck: duck,
        }),
        dismissal: s.dismissal,
      };
    },
  );

  const bowling: CricketBowlingRow[] = [...bowlingStats.entries()].map(
    ([playerId, s]) => {
      const overs = formatCricketOvers(s.legalBalls, ballsPerOver);
      const oversNum =
        Math.floor(s.legalBalls / ballsPerOver) +
        (s.legalBalls % ballsPerOver) / ballsPerOver;
      const maidens = [...s.overRuns.values()].filter((r) => r === 0).length;
      return {
        playerId,
        playerName: playerMap.get(playerId) ?? 'Unknown',
        overs,
        legalBalls: s.legalBalls,
        maidens,
        runs: s.runs,
        wickets: s.wickets,
        economy: oversNum > 0 ? Math.round((s.runs / oversNum) * 100) / 100 : 0,
        points: computeBowlingPoints({ wickets: s.wickets, maidens }),
      };
    },
  );

  const ballEvents: CricketBallEvent[] = inn.balls.map((b) => ({
    id: b.id,
    sequence: b.sequence,
    overNumber: b.overNumber,
    ballInOver: b.ballInOver,
    display: ballDisplay(b),
    totalRuns: b.totalRuns,
    isWicket: b.isWicket,
    commentary: b.commentary,
    batsmanName: playerMap.get(b.batsmanId) ?? 'Unknown',
    bowlerName: playerMap.get(b.bowlerId) ?? 'Unknown',
  }));

  const currentOver = inn.balls.length ? inn.balls[inn.balls.length - 1]!.overNumber : 1;
  const target = inn.dlsParScore ?? inn.targetRuns;

  return {
    id: inn.id,
    inningsNumber: inn.inningsNumber,
    battingTeamId: inn.battingTeamId,
    battingTeamName: teamMap.get(inn.battingTeamId) ?? 'Batting',
    bowlingTeamId: inn.bowlingTeamId,
    bowlingTeamName: teamMap.get(inn.bowlingTeamId) ?? 'Bowling',
    runs: inn.runs,
    wickets: inn.wickets,
    legalBalls: inn.legalBalls,
    oversDisplay: formatCricketOvers(inn.legalBalls, ballsPerOver),
    extras: inn.extras,
    targetRuns: target,
    status: inn.status as CricketInningsStatus,
    endReason: (inn.endReason as CricketInningsEndReason | null) ?? null,
    isAllOut: inn.isAllOut,
    isSuperOver: inn.isSuperOver ?? false,
    declared: inn.declared,
    revisedMaxOvers: inn.revisedMaxOvers,
    dlsParScore: inn.dlsParScore,
    runRate: computeRunRate(inn.runs, inn.legalBalls, ballsPerOver),
    requiredRunRate:
      target != null && effectiveMax > 0
        ? computeRequiredRunRate(
            inn.runs,
            target,
            inn.legalBalls,
            effectiveMax,
            ballsPerOver,
          )
        : null,
    projectedScore:
      inn.status === 'IN_PROGRESS' && effectiveMax > 0
        ? computeProjectedScore(inn.runs, inn.legalBalls, effectiveMax, ballsPerOver)
        : null,
    strikerId: inn.strikerId,
    nonStrikerId: inn.nonStrikerId,
    currentBowlerId: inn.currentBowlerId,
    batting,
    bowling,
    fallOfWickets,
    recentBalls: ballEvents.slice(-12).reverse(),
    currentOverBalls: ballEvents.filter((b) => b.overNumber === currentOver),
    maxWicketsForInnings,
    overCompletePending:
      inn.status === 'IN_PROGRESS' &&
      !inn.currentBowlerId &&
      inn.legalBalls > 0 &&
      inn.legalBalls % ballsPerOver === 0,
    lastOverBowlerId: lastCompletedOverBowlerId(
      inn.balls,
      inn.legalBalls,
      ballsPerOver,
    ),
  };
}

function rosterSizeForTeam(
  cricket: CricketRow,
  teamId: string,
  homeKey: string,
  awayKey: string,
  rosterSizes?: Map<string, number>,
): number {
  const fromMap = rosterSizes?.get(teamId);
  if (fromMap != null && fromMap > 0) return fromMap;
  if (cricket.homeRoster || cricket.awayRoster) {
    const roster =
      teamId === homeKey
        ? (cricket.homeRoster as unknown[] | undefined)
        : (cricket.awayRoster as unknown[] | undefined);
    if (Array.isArray(roster) && roster.length > 0) return roster.length;
  }
  return cricket.maxWickets + 1;
}

export function buildScoreboard(
  cricket: CricketRow,
  teamMap: Map<string, string>,
  playerMap: Map<string, string>,
  homeTeamId?: string | null,
  awayTeamId?: string | null,
  rosterSizes?: Map<string, number>,
): CricketScoreboard {
  const homeKey = homeTeamId ?? 'home';
  const awayKey = awayTeamId ?? 'away';

  const inningsViews = cricket.innings.map((inn) =>
    buildInningsView(
      inn,
      teamMap,
      playerMap,
      cricket.ballsPerOver,
      cricket.maxOvers,
      Math.max(
        1,
        rosterSizeForTeam(cricket, inn.battingTeamId, homeKey, awayKey, rosterSizes) -
          1,
      ),
    ),
  );

  const regularInnings = inningsViews.filter((i) => !i.isSuperOver);
  const superInnings = inningsViews.filter((i) => i.isSuperOver);

  const homeRuns = aggregateTeamRuns(regularInnings, homeKey);
  const awayRuns = aggregateTeamRuns(regularInnings, awayKey);
  const homeWickets = regularInnings
    .filter((i) => i.battingTeamId === homeKey)
    .reduce((sum, i) => sum + i.wickets, 0);
  const awayWickets = regularInnings
    .filter((i) => i.battingTeamId === awayKey)
    .reduce((sum, i) => sum + i.wickets, 0);
  const homeBalls = regularInnings
    .filter((i) => i.battingTeamId === homeKey)
    .reduce((sum, i) => sum + i.legalBalls, 0);
  const awayBalls = regularInnings
    .filter((i) => i.battingTeamId === awayKey)
    .reduce((sum, i) => sum + i.legalBalls, 0);
  const homeCompleted = regularInnings.some(
    (i) => i.battingTeamId === homeKey && i.status === 'COMPLETED',
  );
  const awayCompleted = regularInnings.some(
    (i) => i.battingTeamId === awayKey && i.status === 'COMPLETED',
  );
  const chasing = regularInnings.find(
    (i) => i.status === 'IN_PROGRESS' && i.targetRuns != null,
  );
  const homeName = teamMap.get(homeKey) ?? cricket.homeTeamName ?? 'Home';
  const awayName = teamMap.get(awayKey) ?? cricket.awayTeamName ?? 'Away';

  let result: string | null = null;
  let homePoints = cricket.homePoints;
  let awayPoints = cricket.awayPoints;

  if (homeCompleted && awayCompleted) {
    const homeSo = superInnings.find((i) => i.battingTeamId === homeKey && i.status === 'COMPLETED');
    const awaySo = superInnings.find((i) => i.battingTeamId === awayKey && i.status === 'COMPLETED');

    if (homeSo && awaySo) {
      if (homeSo.runs === awaySo.runs) {
        result = 'Super Over tied — decide by boundary count or bowl-out';
      } else if (homeSo.runs > awaySo.runs) {
        result = `${homeName} won Super Over (${homeSo.runs} vs ${awaySo.runs})`;
        homePoints ??= computeLeaguePoints('win');
        awayPoints ??= computeLeaguePoints('loss');
      } else {
        result = `${awayName} won Super Over (${awaySo.runs} vs ${homeSo.runs})`;
        homePoints ??= computeLeaguePoints('loss');
        awayPoints ??= computeLeaguePoints('win');
      }
    } else if (homeRuns === awayRuns) {
      result = superInnings.length
        ? 'Super Over in progress'
        : cricket.inningsCount >= 4
          ? 'Match drawn'
          : 'Match tied — Super Over required';
      homePoints ??= computeLeaguePoints('tie');
      awayPoints ??= computeLeaguePoints('tie');
    } else if (homeRuns > awayRuns) {
      result = `${homeName} won by ${homeRuns - awayRuns} runs`;
      homePoints ??= computeLeaguePoints('win');
      awayPoints ??= computeLeaguePoints('loss');
    } else {
      result = `${awayName} won by ${awayRuns - homeRuns} runs`;
      homePoints ??= computeLeaguePoints('loss');
      awayPoints ??= computeLeaguePoints('win');
    }
  } else if (chasing?.status === 'IN_PROGRESS' && chasing.targetRuns != null) {
    const need = chasing.targetRuns - chasing.runs;
    result = `${chasing.battingTeamName} need ${need} run${need === 1 ? '' : 's'} (RRR ${chasing.requiredRunRate ?? '—'})`;
  }

  const homeOvers = homeBalls / cricket.ballsPerOver;
  const awayOvers = awayBalls / cricket.ballsPerOver;
  const ppBalls = powerplayLegalBalls(cricket.format);
  const live = inningsViews.find((i) => i.status === 'IN_PROGRESS');
  const powerplay =
    ppBalls != null && live
      ? {
          active: live.legalBalls < ppBalls,
          ballsUsed: Math.min(live.legalBalls, ppBalls),
          ballsTotal: ppBalls,
        }
      : null;
  const followOn = cricketFollowOnState({
    format: cricket.format,
    inningsCount: cricket.inningsCount,
    followOnEnforced: cricket.followOnEnforced,
    followOnMargin: cricket.followOnMargin,
    innings: cricket.innings,
  });

  return {
    id: cricket.id,
    mode: cricket.mode as CricketScoreboard['mode'],
    matchId: cricket.matchId,
    slug: cricket.slug,
    title: cricket.title,
    configured: true,
    format: cricket.format as CricketScoreboard['format'],
    maxOvers: cricket.maxOvers,
    maxWickets: cricket.maxWickets,
    ballsPerOver: cricket.ballsPerOver,
    maxOversPerBowler: cricket.maxOversPerBowler,
    maxBowlersAtLimit: cricket.maxBowlersAtLimit,
    inningsCount: cricket.inningsCount,
    followOnEnforced: cricket.followOnEnforced ?? false,
    followOnMargin: cricket.followOnMargin ?? null,
    followOn,
    powerplay,
    strikeRotationMode: (cricket.strikeRotationMode ?? 'AUTO') as CricketScoreboard['strikeRotationMode'],
    superOverPending: cricket.superOverPending ?? false,
    homeTeamName: cricket.homeTeamName,
    awayTeamName: cricket.awayTeamName,
    innings: inningsViews,
    matchSummary: {
      homeRuns: homeCompleted || homeRuns > 0 ? homeRuns : null,
      awayRuns: awayCompleted || awayRuns > 0 ? awayRuns : null,
      homeWickets: homeCompleted || homeWickets > 0 ? homeWickets : null,
      awayWickets: awayCompleted || awayWickets > 0 ? awayWickets : null,
      homePoints,
      awayPoints,
      homeNetRunRate:
        homeCompleted && awayCompleted
          ? computeNetRunRate(homeRuns, homeOvers, awayRuns, awayOvers)
          : null,
      awayNetRunRate:
        homeCompleted && awayCompleted
          ? computeNetRunRate(awayRuns, awayOvers, homeRuns, homeOvers)
          : null,
      result,
    },
  };
}

export function emptyScoreboard(
  cricket: Partial<CricketRow> & { id: string },
): CricketScoreboard {
  return {
    id: cricket.id,
    mode: (cricket.mode ?? 'TOURNAMENT') as CricketScoreboard['mode'],
    matchId: cricket.matchId ?? null,
    slug: cricket.slug ?? null,
    title: cricket.title ?? null,
    configured: false,
    format: null,
    maxOvers: cricket.maxOvers ?? 20,
    maxWickets: cricket.maxWickets ?? 10,
    ballsPerOver: cricket.ballsPerOver ?? 6,
    maxOversPerBowler: cricket.maxOversPerBowler ?? 4,
    maxBowlersAtLimit: cricket.maxBowlersAtLimit ?? 5,
    inningsCount: cricket.inningsCount ?? 2,
    followOnEnforced: false,
    followOnMargin: null,
    followOn: null,
    powerplay: null,
    strikeRotationMode: 'AUTO',
    superOverPending: false,
    homeTeamName: cricket.homeTeamName ?? null,
    awayTeamName: cricket.awayTeamName ?? null,
    innings: [],
    matchSummary: {
      homeRuns: null,
      awayRuns: null,
      homeWickets: null,
      awayWickets: null,
      homePoints: null,
      awayPoints: null,
      homeNetRunRate: null,
      awayNetRunRate: null,
      result: null,
    },
  };
}
