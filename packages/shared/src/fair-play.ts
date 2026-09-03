/** FIFA-style fair play points from discipline (lower is better). */
export function fairPlayPointsFromCards(
  yellowCards: number,
  redCards: number,
): number {
  return yellowCards + redCards * 3;
}

export function rollupTeamFairPlayFromStats(
  stats: Array<{ yellowCards?: number; redCards?: number }>,
): number {
  return stats.reduce(
    (sum, s) =>
      sum +
      fairPlayPointsFromCards(s.yellowCards ?? 0, s.redCards ?? 0),
    0,
  );
}
