import type { Match, Team, Tournament } from '@/lib/types';
import type { TournamentMvpRow } from '@bracket/shared';

export type TeamPerformanceRow = {
  teamId: string;
  teamName: string;
  seed: number | null;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  mvpAwards: number;
  rank: number;
};

export type KnockoutStatRow = {
  teamId: string;
  teamName: string;
  seed: number | null;
  lastRound: number | null;
  lastRoundLabel: string;
  placement: string;
  wins: number;
  losses: number;
};

const ELIM_SIDES = new Set(['WINNERS', 'LOSERS', 'FINAL', 'GRAND_FINAL']);

export function hasKnockoutPhase(tournament: Tournament): boolean {
  const format = tournament.format;
  if (
    format === 'SINGLE_ELIMINATION' ||
    format === 'DOUBLE_ELIMINATION'
  ) {
    return true;
  }
  if (format === 'GROUPS_KNOCKOUT') {
    return tournament.matches.some((m) => m.bracketSide !== 'GROUP');
  }
  return false;
}

export function knockoutMatches(tournament: Tournament): Match[] {
  if (tournament.format === 'GROUPS_KNOCKOUT') {
    return tournament.matches.filter((m) => m.bracketSide !== 'GROUP');
  }
  return tournament.matches.filter((m) => ELIM_SIDES.has(m.bracketSide));
}

function roundLabel(round: number, totalRounds: number): string {
  const teamsLeft = 2 ** (totalRounds - round + 1);
  if (teamsLeft <= 2) return 'Final';
  if (teamsLeft <= 4) return 'Semifinals';
  if (teamsLeft <= 8) return 'Quarterfinals';
  return `Round ${round}`;
}

export function computeTeamPerformance(
  tournament: Tournament,
  mvpRows: TournamentMvpRow[] = [],
): TeamPerformanceRow[] {
  const mvpByTeam = new Map<string, number>();
  for (const r of mvpRows) {
    mvpByTeam.set(r.teamId, (mvpByTeam.get(r.teamId) ?? 0) + r.mvpAwards);
  }

  if (tournament.standings?.length) {
    return [...tournament.standings]
      .sort((a, b) => a.rank - b.rank)
      .map((s) => ({
        teamId: s.teamId,
        teamName: s.team.name,
        seed: s.team.seed ?? null,
        played: s.played,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        goalsFor: s.pointsFor,
        goalsAgainst: s.pointsAgainst,
        points: s.points,
        mvpAwards: mvpByTeam.get(s.teamId) ?? 0,
        rank: s.rank,
      }));
  }

  const byTeam = new Map<
    string,
    Omit<TeamPerformanceRow, 'rank' | 'teamName' | 'seed'>
  >();

  for (const team of tournament.teams) {
    byTeam.set(team.id, {
      teamId: team.id,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      mvpAwards: mvpByTeam.get(team.id) ?? 0,
    });
  }

  for (const m of tournament.matches.filter((x) => x.status === 'COMPLETED')) {
    if (!m.homeTeamId || !m.awayTeamId) continue;
    const home = byTeam.get(m.homeTeamId);
    const away = byTeam.get(m.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += m.homeScore ?? 0;
    home.goalsAgainst += m.awayScore ?? 0;
    away.goalsFor += m.awayScore ?? 0;
    away.goalsAgainst += m.homeScore ?? 0;

    if (m.isDraw) {
      home.draws += 1;
      away.draws += 1;
      home.points += tournament.pointsDraw;
      away.points += tournament.pointsDraw;
    } else if (m.winnerTeamId === m.homeTeamId) {
      home.wins += 1;
      away.losses += 1;
      home.points += tournament.pointsWin;
    } else if (m.winnerTeamId === m.awayTeamId) {
      away.wins += 1;
      home.losses += 1;
      away.points += tournament.pointsWin;
    }
  }

  const teamMap = new Map(tournament.teams.map((t) => [t.id, t]));
  return [...byTeam.values()]
    .map((row) => {
      const team = teamMap.get(row.teamId);
      return {
        ...row,
        teamName: team?.name ?? 'Unknown',
        seed: team?.seed ?? null,
        rank: 0,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.goalsFor - a.goalsAgainst;
      const diffB = b.goalsFor - b.goalsAgainst;
      return diffB - diffA;
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function computeKnockoutStats(tournament: Tournament): KnockoutStatRow[] {
  const matches = knockoutMatches(tournament).filter(
    (m) => m.status === 'COMPLETED',
  );
  if (!matches.length) return [];

  const totalRounds = Math.max(...matches.map((m) => m.round));
  const byTeam = new Map<
    string,
    {
      team: Team;
      lastRound: number;
      wins: number;
      losses: number;
      placement: string;
    }
  >();

  for (const team of tournament.teams) {
    byTeam.set(team.id, {
      team,
      lastRound: 0,
      wins: 0,
      losses: 0,
      placement: 'Active',
    });
  }

  for (const m of matches) {
    if (!m.homeTeamId || !m.awayTeamId) continue;
    const home = byTeam.get(m.homeTeamId);
    const away = byTeam.get(m.awayTeamId);
    if (!home || !away) continue;

    home.lastRound = Math.max(home.lastRound, m.round);
    away.lastRound = Math.max(away.lastRound, m.round);

    if (m.isDraw) continue;
    if (m.winnerTeamId === m.homeTeamId) {
      home.wins += 1;
      away.losses += 1;
    } else if (m.winnerTeamId === m.awayTeamId) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  const championId =
    tournament.matches.find(
      (m) =>
        m.status === 'COMPLETED' &&
        (m.bracketSide === 'FINAL' || m.bracketSide === 'GRAND_FINAL') &&
        m.winnerTeamId,
    )?.winnerTeamId ?? null;

  for (const row of byTeam.values()) {
    if (row.team.id === championId) {
      row.placement = 'Champion';
    } else if (row.losses > 0 && row.lastRound === totalRounds) {
      row.placement = 'Finalist';
    } else if (row.losses > 0) {
      row.placement = `Eliminated · ${roundLabel(row.lastRound, totalRounds)}`;
    } else if (row.wins > 0) {
      row.placement = row.lastRound === totalRounds ? 'Finalist' : 'Active';
    } else {
      row.placement = '—';
    }
  }

  return [...byTeam.values()]
    .map((r) => ({
      teamId: r.team.id,
      teamName: r.team.name,
      seed: r.team.seed ?? null,
      lastRound: r.lastRound || null,
      lastRoundLabel: r.lastRound
        ? roundLabel(r.lastRound, totalRounds)
        : '—',
      placement: r.placement,
      wins: r.wins,
      losses: r.losses,
    }))
    .sort((a, b) => {
      const order = (p: string) => {
        if (p === 'Champion') return 0;
        if (p === 'Finalist') return 1;
        if (p.startsWith('Active')) return 2;
        return 3;
      };
      const d = order(a.placement) - order(b.placement);
      if (d !== 0) return d;
      return (a.seed ?? 999) - (b.seed ?? 999);
    });
}
