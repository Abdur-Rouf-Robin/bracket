'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expectedGroupSizes } from '@bracket/bracket-engine';
import { SHUFFLE_POOL_COLORS, rosterLimits, type TournamentSettings } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';

type ShuffleMode = 'SERPENTINE' | 'BALANCED' | 'RANDOM' | 'POT';
type ShuffleTarget = 'TEAMS_TO_GROUPS' | 'PLAYERS_TO_TEAMS';

export function TournamentToolsPanel({
  tournament,
  token,
  embedded = false,
}: {
  tournament: Tournament;
  token: string;
  embedded?: boolean;
}) {
  const qc = useQueryClient();
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const [groupCount, setGroupCount] = useState(2);
  const [shuffleMode, setShuffleMode] = useState<ShuffleMode>(
    (settings.groupDrawMode as ShuffleMode) ?? 'SERPENTINE',
  );
  const [shuffleTarget, setShuffleTarget] =
    useState<ShuffleTarget>('TEAMS_TO_GROUPS');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerColor, setPlayerColor] = useState('YELLOW');
  const [adminEmail, setAdminEmail] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [color, setColor] = useState('YELLOW');
  const [msg, setMsg] = useState('');

  const limits = rosterLimits(settings);

  const allPlayers = useMemo(
    () =>
      tournament.teams.flatMap((t) =>
        (t.players ?? []).map((p) => ({ ...p, teamName: t.name })),
      ),
    [tournament.teams],
  );

  const groupSizePreview =
    shuffleTarget === 'TEAMS_TO_GROUPS' && tournament.teams.length > 0
      ? expectedGroupSizes(tournament.teams.length, groupCount)
      : [];

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements', tournament.id],
    queryFn: () =>
      api<
        { id: string; title: string; body: string; pinned: boolean }[]
      >(`/tournaments/${tournament.id}/announcements`),
    enabled: settings.showAnnouncementTab !== false,
  });

  const { data: drawAudit } = useQuery({
    queryKey: ['draw-audit', tournament.slug],
    queryFn: () =>
      api<{
        enabled: boolean;
        log: Array<{
          at: string;
          operation: string;
          seed: string;
          seedHash: string;
          inputOrder: string[];
          outputOrder: string[];
        }>;
        drawSeed: string | null;
      }>(`/t/${tournament.slug}/draw-audit`),
    enabled: settings.auditableDraw === true,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    await qc.invalidateQueries({ queryKey: ['announcements', tournament.id] });
    await qc.invalidateQueries({ queryKey: ['draw-audit', tournament.slug] });
  };

  const shuffleMutation = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}/shuffle/groups`, {
        method: 'POST',
        token,
        body: JSON.stringify({ groupCount, mode: shuffleMode }),
      }),
    onSuccess: async () => {
      setMsg('Groups assigned');
      await invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const playerColorMutation = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}/pool-colors`, {
        method: 'POST',
        token,
        body: JSON.stringify({ playerIds: selectedPlayers, poolColor: playerColor }),
      }),
    onSuccess: async () => {
      setMsg(`Marked ${selectedPlayers.length} player(s)`);
      setSelectedPlayers([]);
      await invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const colorMutation = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}/pool-colors`, {
        method: 'POST',
        token,
        body: JSON.stringify({ teamIds: selectedTeams, poolColor: color }),
      }),
    onSuccess: async () => {
      setMsg(`Marked ${selectedTeams.length} team(s) ${color}`);
      await invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const isPlayers = shuffleTarget === 'PLAYERS_TO_TEAMS';
      const pools = SHUFFLE_POOL_COLORS.map((c) => ({
        color: c.key,
        itemIds: isPlayers
          ? allPlayers
              .filter((p) => p.poolColor === c.key)
              .map((p) => p.id)
          : tournament.teams
              .filter((t) => t.poolColor === c.key)
              .map((t) => t.id),
      })).filter((p) => p.itemIds.length > 0);

      if (!pools.length) {
        throw new Error(
          isPlayers
            ? 'Mark players with pool colors first'
            : 'Mark teams with pool colors first',
        );
      }

      return api(`/tournaments/${tournament.id}/shuffle/color-draft`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          teamCount: groupCount,
          pools,
          target: shuffleTarget,
        }),
      });
    },
    onSuccess: async () => {
      setMsg(
        shuffleTarget === 'PLAYERS_TO_TEAMS'
          ? 'Players drafted into teams'
          : 'Color-pool draft applied to groups',
      );
      await invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const annMutation = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}/announcements`, {
        method: 'POST',
        token,
        body: JSON.stringify({ title: annTitle, body: annBody }),
      }),
    onSuccess: async () => {
      setAnnTitle('');
      setAnnBody('');
      await invalidate();
    },
  });

  const adminMutation = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}/admins`, {
        method: 'POST',
        token,
        body: JSON.stringify({ email: adminEmail }),
      }),
    onSuccess: () => {
      setAdminEmail('');
      setMsg('Admin access shared');
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const colorLegend = useMemo(
    () =>
      SHUFFLE_POOL_COLORS.map((c) => ({
        ...c,
        count: tournament.teams.filter(
          (t) => (t as { poolColor?: string | null }).poolColor === c.key,
        ).length,
      })),
    [tournament.teams],
  );

  return (
    <div className={embedded ? 'space-y-8' : 'mt-10 space-y-8'}>
      <section className="panel-card rounded-2xl p-5">
        <h2 className="font-display text-xl font-semibold">Draw & shuffle</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          International-style group draw (balanced sizes, pot draw by seed) or
          color-pool draft for teams and players.
        </p>
        {settings.auditableDraw && (
          <Link
            href={`/t/${tournament.slug}/draw`}
            className="mt-2 inline-block text-sm text-[var(--color-accent)] underline"
          >
            Live draw ceremony (spectator view)
          </Link>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['TEAMS_TO_GROUPS', 'Teams → groups'],
              ['PLAYERS_TO_TEAMS', 'Players → teams'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setShuffleTarget(value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                shuffleTarget === value
                  ? 'bg-[var(--color-accent)] text-[#0a0c10]'
                  : 'border border-[var(--color-line)] text-[var(--color-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>
              {shuffleTarget === 'TEAMS_TO_GROUPS'
                ? 'Number of groups'
                : 'Number of teams (draft slots)'}
            </Label>
            <Input
              type="number"
              min={2}
              max={shuffleTarget === 'TEAMS_TO_GROUPS' ? 16 : 32}
              value={groupCount}
              onChange={(e) => setGroupCount(Number(e.target.value))}
            />
            {shuffleTarget === 'TEAMS_TO_GROUPS' && tournament.teams.length > 0 && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Expected group sizes:{' '}
                {groupSizePreview.join(', ')}
              </p>
            )}
          </div>
          {shuffleTarget === 'TEAMS_TO_GROUPS' && (
            <div>
              <Label>Draw method</Label>
              <div className="mt-2 space-y-1">
                {(
                  [
                    ['SERPENTINE', 'Serpentine by seed (standard)'],
                    ['BALANCED', 'Balanced random (serpentine)'],
                    ['POT', 'Pot draw by seed (FIFA/UEFA style)'],
                    ['RANDOM', 'Simple random deal'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="shuffleMode"
                      checked={shuffleMode === value}
                      onChange={() => setShuffleMode(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {shuffleTarget === 'TEAMS_TO_GROUPS' && (
          <div className="mt-4">
            <Button
              type="button"
              disabled={shuffleMutation.isPending}
              onClick={() => shuffleMutation.mutate()}
            >
              Run group draw
            </Button>
          </div>
        )}

        <div className="mt-6 border-t border-[var(--color-line)] pt-6">
          <Label>
            Color pools — mark{' '}
            {shuffleTarget === 'PLAYERS_TO_TEAMS' ? 'players' : 'teams'}
          </Label>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Like World Cup pots: one pick from each color per slot, then serpentine
            balance across {shuffleTarget === 'PLAYERS_TO_TEAMS' ? 'teams' : 'groups'}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SHUFFLE_POOL_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() =>
                  shuffleTarget === 'PLAYERS_TO_TEAMS'
                    ? setPlayerColor(c.key)
                    : setColor(c.key)
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
                  (shuffleTarget === 'PLAYERS_TO_TEAMS'
                    ? playerColor
                    : color) === c.key
                    ? 'ring-2 ring-offset-2 ring-black'
                    : ''
                }`}
                style={{ background: c.hex }}
              >
                {c.label} (
                {shuffleTarget === 'PLAYERS_TO_TEAMS'
                  ? allPlayers.filter((p) => p.poolColor === c.key).length
                  : colorLegend.find((x) => x.key === c.key)?.count ?? 0}
                )
              </button>
            ))}
          </div>

          {shuffleTarget === 'TEAMS_TO_GROUPS' ? (
            <>
              <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                {tournament.teams.map((t) => {
                  const pc = t.poolColor;
                  const checked = selectedTeams.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedTeams((prev) =>
                            e.target.checked
                              ? [...prev, t.id]
                              : prev.filter((x) => x !== t.id),
                          );
                        }}
                      />
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{
                          background:
                            SHUFFLE_POOL_COLORS.find((c) => c.key === pc)?.hex ??
                            '#ccc',
                        }}
                      />
                      {t.name}
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!selectedTeams.length || colorMutation.isPending}
                  onClick={() => colorMutation.mutate()}
                >
                  Apply color to selected teams
                </Button>
                <Button
                  type="button"
                  disabled={draftMutation.isPending}
                  onClick={() => draftMutation.mutate()}
                >
                  Color-pool draft into groups
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
                {allPlayers.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(p.id)}
                      onChange={(e) => {
                        setSelectedPlayers((prev) =>
                          e.target.checked
                            ? [...prev, p.id]
                            : prev.filter((x) => x !== p.id),
                        );
                      }}
                    />
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{
                        background:
                          SHUFFLE_POOL_COLORS.find(
                            (c) => c.key === p.poolColor,
                          )?.hex ?? '#ccc',
                      }}
                    />
                    {p.name}
                    <span className="text-[var(--color-muted)]">
                      · {p.teamName}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!selectedPlayers.length || playerColorMutation.isPending}
                  onClick={() => playerColorMutation.mutate()}
                >
                  Apply color to selected players
                </Button>
                <Button
                  type="button"
                  disabled={draftMutation.isPending || !allPlayers.length}
                  onClick={() => draftMutation.mutate()}
                >
                  Draft players into teams
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)]">
          <strong className="text-[var(--color-ink)]">Roster rules:</strong>{' '}
          {limits.starters} starter{limits.starters === 1 ? '' : 's'} per team
          {settings.allowSubstitutes
            ? ` · up to ${limits.substituteSlots} substitute${limits.substituteSlots === 1 ? '' : 's'} (max ${limits.maxRoster} total)`
            : ' · substitutes disabled'}
        </div>

        {msg && <p className="mt-3 text-sm text-[var(--color-muted)]">{msg}</p>}

        {settings.auditableDraw && (
          <div className="mt-6 border-t border-[var(--color-line)] pt-4">
            <h3 className="text-sm font-semibold">Draw audit log</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Seeded, reproducible draw history for transparency.
            </p>
            {!drawAudit?.enabled || !drawAudit.log.length ? (
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                No auditable draws recorded yet — generate or shuffle groups with
                auditable draw enabled.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {drawAudit.log.map((entry, i) => (
                  <div
                    key={`${entry.at}-${i}`}
                    className="rounded-lg border border-[var(--color-line)] p-3 text-xs"
                  >
                    <p className="font-semibold">{entry.operation}</p>
                    <p className="text-[var(--color-muted)]">
                      {new Date(entry.at).toLocaleString()}
                    </p>
                    <p className="mt-1 font-mono break-all">
                      Seed hash: {entry.seedHash}
                    </p>
                    <p className="mt-1 text-[var(--color-muted)]">
                      {entry.inputOrder.length} teams in →{' '}
                      {entry.outputOrder.length} assigned
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {settings.showAnnouncementTab !== false && (
        <section className="panel-card rounded-2xl p-5">
          <h2 className="font-display text-xl font-semibold">Announcements</h2>
          <div className="mt-3 space-y-2">
            <Input
              placeholder="Title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
            />
            <textarea
              className="min-h-[80px] w-full rounded-md border border-[var(--color-line)] px-3 py-2 text-sm"
              placeholder="Announcement body"
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
            />
            <Button
              type="button"
              disabled={!annTitle.trim() || !annBody.trim()}
              onClick={() => annMutation.mutate()}
            >
              Post announcement
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-[var(--color-line)] px-3 py-2"
              >
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-[var(--color-muted)]">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel-card rounded-2xl p-5">
        <h2 className="font-display text-xl font-semibold">Share admin access</h2>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="admin@example.com"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
          <Button
            type="button"
            disabled={!adminEmail.trim() || adminMutation.isPending}
            onClick={() => adminMutation.mutate()}
          >
            Invite
          </Button>
        </div>
      </section>
    </div>
  );
}
