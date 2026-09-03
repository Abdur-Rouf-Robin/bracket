import { computeNetRunRate } from '@bracket/shared';
import { MatchStatus } from '@prisma/client';

type CricketInningsRow = {
  battingTeamId: string;
  runs: number;
  legalBalls: number;
  isSuperOver: boolean;
};

type CricketMatchRow = {
  ballsPerOver: number;
  match: {
    homeTeamId: string | null;
    awayTeamId: string | null;
    status: MatchStatus;
    isNoResult: boolean;
  } | null;
  innings: CricketInningsRow[];
};

/** Aggregate ICC-style net run rate per team from completed cricket matches. */
export function computeCricketNrrByTeam(
  teamIds: string[],
  cricketMatches: CricketMatchRow[],
): Map<string, number> {
  const totals = new Map<
    string,
    { runsFor: number; oversFaced: number; runsAgainst: number; oversBowled: number }
  >();

  for (const id of teamIds) {
    totals.set(id, { runsFor: 0, oversFaced: 0, runsAgainst: 0, oversBowled: 0 });
  }

  for (const cm of cricketMatches) {
    const m = cm.match;
    if (!m?.homeTeamId || !m?.awayTeamId) continue;
    if (m.status !== MatchStatus.COMPLETED || m.isNoResult) continue;

    const regular = cm.innings.filter((i) => !i.isSuperOver);
    const homeInn = regular.find((i) => i.battingTeamId === m.homeTeamId);
    const awayInn = regular.find((i) => i.battingTeamId === m.awayTeamId);
    if (!homeInn || !awayInn) continue;

    const bpo = cm.ballsPerOver || 6;
    const homeOvers = homeInn.legalBalls / bpo;
    const awayOvers = awayInn.legalBalls / bpo;

    for (const teamId of [m.homeTeamId, m.awayTeamId]) {
      const t = totals.get(teamId);
      if (!t) continue;
      if (teamId === m.homeTeamId) {
        t.runsFor += homeInn.runs;
        t.oversFaced += homeOvers;
        t.runsAgainst += awayInn.runs;
        t.oversBowled += awayOvers;
      } else {
        t.runsFor += awayInn.runs;
        t.oversFaced += awayOvers;
        t.runsAgainst += homeInn.runs;
        t.oversBowled += homeOvers;
      }
    }
  }

  const result = new Map<string, number>();
  for (const id of teamIds) {
    const t = totals.get(id)!;
    result.set(
      id,
      computeNetRunRate(t.runsFor, t.oversFaced, t.runsAgainst, t.oversBowled),
    );
  }
  return result;
}
