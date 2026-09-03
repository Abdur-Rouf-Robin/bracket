import type { Team } from '@/lib/types';

export const TEAM_PALETTE = [
  '#e63946',
  '#457b9d',
  '#2a9d8f',
  '#e9c46a',
  '#f4a261',
  '#264653',
  '#8338ec',
  '#fb5607',
  '#3a86ff',
  '#06d6a0',
];

export function hashTeamColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TEAM_PALETTE[Math.abs(h) % TEAM_PALETTE.length]!;
}

export function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function teamColor(
  team: { name: string; poolColor?: string | null } | null | undefined,
): string {
  if (!team) return '#393e46';
  return team.poolColor ?? hashTeamColor(team.name);
}

export function teamFromShare(
  side: {
    id?: string | null;
    name: string;
    poolColor?: string | null;
    seed?: number | null;
  },
): Team {
  return {
    id: side.id ?? '',
    name: side.name,
    seed: side.seed ?? null,
    groupId: null,
    poolColor: side.poolColor ?? null,
  };
}
