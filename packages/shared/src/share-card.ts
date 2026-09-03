export type ShareCardTeam = {
  id: string | null;
  name: string;
  score: number | null;
  percent: number | null;
  poolColor: string | null;
  seed: number | null;
  isWinner: boolean;
};

export type ShareCardDisplayMode = 'score' | 'percent' | 'both';

export type ShareCardPayload = {
  tournamentName: string;
  gameName: string | null;
  format: string | null;
  round: number;
  bracketSide: string;
  roundLabel: string;
  allowPercent: boolean;
  displayMode: ShareCardDisplayMode;
  home: ShareCardTeam;
  away: ShareCardTeam;
  winner: string | null;
  winnerSide: 'home' | 'away' | 'draw' | null;
  isDraw: boolean;
  scoreMargin: number | null;
  percentMargin: number | null;
  totalScore: number | null;
  mvp?: {
    playerId: string;
    playerName: string;
    teamName: string;
    mvpScore: number;
    stats: {
      goals: number;
      assists: number;
      points: number;
      kills: number;
      deaths: number;
      rating: number | null;
    };
  } | null;
};

export function resolveShareCardDisplayMode(
  allowPercent: boolean,
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
  homePercent: number | null | undefined,
  awayPercent: number | null | undefined,
): ShareCardDisplayMode {
  const hasPercent = homePercent != null || awayPercent != null;
  const hasScore = homeScore != null || awayScore != null;
  if (allowPercent && hasPercent && hasScore) return 'both';
  if (allowPercent && hasPercent) return 'percent';
  return 'score';
}

export function resolveWinnerSide(
  isDraw: boolean,
  winnerTeamId: string | null | undefined,
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
): 'home' | 'away' | 'draw' | null {
  if (isDraw) return 'draw';
  if (!winnerTeamId) return null;
  if (winnerTeamId === homeTeamId) return 'home';
  if (winnerTeamId === awayTeamId) return 'away';
  return null;
}

export function defaultRoundLabelForShare(
  round: number,
  totalRounds?: number,
): string {
  if (totalRounds) {
    const teamsLeft = 2 ** (totalRounds - round + 1);
    if (teamsLeft <= 2) return 'Final';
    if (teamsLeft === 4) return 'Semi-finals';
    if (teamsLeft === 8) return 'Quarter-finals';
    if (teamsLeft >= 16) return `Round of ${teamsLeft}`;
  }
  return `Round ${round}`;
}

export function buildShareCardPayload(input: {
  tournamentName: string;
  gameName?: string | null;
  format: string | null;
  round: number;
  bracketSide: string;
  allowPercent: boolean;
  home: {
    id: string | null;
    name: string;
    score: number | null;
    percent: number | null;
    poolColor: string | null;
    seed: number | null;
  };
  away: {
    id: string | null;
    name: string;
    score: number | null;
    percent: number | null;
    poolColor: string | null;
    seed: number | null;
  };
  winnerTeamId: string | null;
  winnerName: string | null;
  isDraw: boolean;
  totalRounds?: number;
  mvp?: ShareCardPayload['mvp'];
}): ShareCardPayload {
  const winnerSide = resolveWinnerSide(
    input.isDraw,
    input.winnerTeamId,
    input.home.id,
    input.away.id,
  );

  const homeScore = input.home.score ?? 0;
  const awayScore = input.away.score ?? 0;
  const homePercent = input.home.percent;
  const awayPercent = input.away.percent;

  const displayMode = resolveShareCardDisplayMode(
    input.allowPercent,
    input.home.score,
    input.away.score,
    input.home.percent,
    input.away.percent,
  );

  return {
    tournamentName: input.tournamentName,
    gameName: input.gameName ?? null,
    format: input.format,
    round: input.round,
    bracketSide: input.bracketSide,
    roundLabel: defaultRoundLabelForShare(input.round, input.totalRounds),
    allowPercent: input.allowPercent,
    displayMode,
    home: {
      ...input.home,
      isWinner: winnerSide === 'home',
    },
    away: {
      ...input.away,
      isWinner: winnerSide === 'away',
    },
    winner: input.isDraw ? 'Draw' : input.winnerName,
    winnerSide,
    isDraw: input.isDraw,
    scoreMargin:
      input.home.score != null && input.away.score != null
        ? homeScore - awayScore
        : null,
    percentMargin:
      homePercent != null && awayPercent != null
        ? homePercent - awayPercent
        : null,
    totalScore:
      input.home.score != null && input.away.score != null
        ? homeScore + awayScore
        : null,
    mvp: input.mvp ?? null,
  };
}
