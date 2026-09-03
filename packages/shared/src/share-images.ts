/** Recommended asset dimensions for share images (PNG/JPG/WebP URLs). */
export const SHARE_IMAGE_ASSET_SPECS = {
  tournament: {
    backgroundImageUrl: {
      label: 'Tournament background',
      usedIn: ['prematch', 'result', 'mvp', 'congrats'],
      ratio: '16:9 or 1:1',
      minSize: '1920×1080',
      notes: 'Stadium, arena, or branded backdrop. Dark/mid-tone works best for text overlay.',
    },
    logoUrl: {
      label: 'Tournament logo',
      usedIn: ['prematch', 'result', 'mvp', 'congrats'],
      ratio: '1:1',
      minSize: '512×512',
      notes: 'Top corner badge on all share cards.',
    },
  },
  team: {
    logoUrl: {
      label: 'Team logo',
      usedIn: ['prematch', 'result', 'congrats'],
      ratio: '1:1',
      minSize: '512×512',
      notes: 'Shield/badge style. Shown on both sides of VS and result cards.',
    },
    teamPhotoUrl: {
      label: 'Full team photo',
      usedIn: ['congrats'],
      ratio: '16:9 or 4:3',
      minSize: '1600×900',
      notes: 'Celebration/group shot for stage-win congratulations cards.',
    },
  },
  player: {
    photoUrl: {
      label: 'Player photo',
      usedIn: ['prematch (captain)', 'mvp'],
      ratio: '3:4 portrait',
      minSize: '800×1000',
      notes: 'Cutout or portrait. Captains used on pre-match; MVP player on MVP card.',
    },
    isCaptain: {
      label: 'Captain flag',
      usedIn: ['prematch'],
      notes: 'Mark one player per team as captain for pre-match scheduling images.',
    },
  },
} as const;

export type ShareTeamVisual = {
  id: string | null;
  name: string;
  logoUrl: string | null;
  teamPhotoUrl: string | null;
  poolColor: string | null;
  captain?: {
    id: string;
    name: string;
    photoUrl: string | null;
  } | null;
};

export type ShareTournamentVisual = {
  name: string;
  gameName: string | null;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
  slug: string;
};

export function formatVenue(t: {
  venueType?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  venueUrl?: string | null;
}): string | null {
  if (t.venueType === 'ONLINE') {
    const label = t.venueName?.trim() || 'Online';
    return t.venueUrl?.trim() ? `${label} · ${t.venueUrl.trim()}` : label;
  }
  if (t.venueType === 'PHYSICAL') {
    const parts = [t.venueName, t.venueAddress].filter((x) => x?.trim());
    return parts.length ? parts.join(' · ') : null;
  }
  const parts = [t.venueName, t.venueAddress, t.venueUrl].filter((x) => x?.trim());
  return parts.length ? parts.join(' · ') : null;
}

export function formatShareDateTime(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type PrematchSharePayload = {
  type: 'prematch';
  tournament: ShareTournamentVisual;
  round: number;
  roundLabel: string;
  bracketSide: string;
  scheduledAt: string | null;
  venue: string | null;
  station?: string | null;
  home: ShareTeamVisual;
  away: ShareTeamVisual;
};

export type ResultSharePayload = {
  type: 'result';
  tournament: ShareTournamentVisual;
  round: number;
  roundLabel: string;
  bracketSide: string;
  displayMode: 'score' | 'percent' | 'both';
  home: ShareTeamVisual & {
    score: number | null;
    percent: number | null;
    isWinner: boolean;
    scorers: string[];
  };
  away: ShareTeamVisual & {
    score: number | null;
    percent: number | null;
    isWinner: boolean;
    scorers: string[];
  };
  isDraw: boolean;
  winner: string | null;
  scoreMargin: number | null;
};

export type MvpSharePayload = {
  type: 'mvp';
  tournament: ShareTournamentVisual;
  round: number;
  roundLabel: string;
  matchLabel: string;
  player: {
    id: string;
    name: string;
    photoUrl: string | null;
    teamName: string;
    teamLogoUrl: string | null;
  };
  stats: {
    goals: number;
    assists: number;
    points: number;
    kills: number;
    deaths: number;
    rating: number | null;
    mvpScore: number;
  };
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type CongratsSharePayload = {
  type: 'congrats';
  tournament: ShareTournamentVisual;
  team: ShareTeamVisual;
  stageLabel: string;
  stageType: 'group' | 'knockout' | 'final' | 'tournament';
  opponentName: string | null;
  score: string | null;
};

export type AnySharePayload =
  | PrematchSharePayload
  | ResultSharePayload
  | MvpSharePayload
  | CongratsSharePayload;

export function captainFromPlayers(
  players: Array<{
    id: string;
    name: string;
    photoUrl?: string | null;
    isCaptain?: boolean;
  }>,
): { id: string; name: string; photoUrl: string | null } | null {
  const cap = players.find((p) => p.isCaptain);
  if (cap) return { id: cap.id, name: cap.name, photoUrl: cap.photoUrl ?? null };
  const first = players[0];
  return first
    ? { id: first.id, name: first.name, photoUrl: first.photoUrl ?? null }
    : null;
}
