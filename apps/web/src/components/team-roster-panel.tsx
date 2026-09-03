'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageUrlField } from '@/components/image-url-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rosterLimits, type TournamentSettings } from '@bracket/shared';
import { api } from '@/lib/api';
import type { Team, TeamPlayer, Tournament } from '@/lib/types';

type PlayerDraft = {
  key: string;
  id?: string;
  name: string;
  photoUrl: string;
  isCaptain: boolean;
  isSub: boolean;
  delete?: boolean;
};

function playerKey(p: TeamPlayer | PlayerDraft) {
  return 'id' in p && p.id ? p.id : (p as PlayerDraft).key;
}

function teamDraftFromTeam(team: Team): {
  logoUrl: string;
  teamPhotoUrl: string;
  players: PlayerDraft[];
} {
  return {
    logoUrl: team.logoUrl ?? '',
    teamPhotoUrl: team.teamPhotoUrl ?? '',
    players: (team.players ?? []).map((p) => ({
      key: p.id,
      id: p.id,
      name: p.name,
      photoUrl: p.photoUrl ?? '',
      isCaptain: p.isCaptain ?? false,
      isSub: p.isSub ?? false,
    })),
  };
}

export function TeamRosterPanel({
  tournament,
  token,
  embedded = false,
}: {
  tournament: Tournament;
  token: string;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(embedded);

  const body = (
    <div className={embedded ? 'space-y-3' : 'panel-card mt-3 space-y-3 rounded-xl p-4'}>
      <p className="text-xs text-[var(--color-muted)]">
        Set each team&apos;s logo, full team photo, and player names with
        photos. Used on match preview cards, results, and MVP graphics.
      </p>
      {tournament.teams.map((team) => (
        <TeamRosterEditor
          key={team.id}
          team={team}
          tournament={tournament}
          token={token}
        />
      ))}
    </div>
  );

  if (embedded) return body;

  return (
    <section className="mt-10">
      <button
        type="button"
        className="font-display text-xl font-semibold hover:text-[var(--color-accent)]"
        onClick={() => setOpen((v) => !v)}
      >
        Team rosters & images {open ? '▾' : '▸'}
      </button>
      {open && body}
    </section>
  );
}

function TeamRosterEditor({
  team,
  tournament,
  token,
}: {
  team: Team;
  tournament: Tournament;
  token: string;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(() => teamDraftFromTeam(team));
  const [msg, setMsg] = useState('');

  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const limits = rosterLimits(settings);
  const allowSubs = settings.allowSubstitutes === true;
  const rosterLocked =
    settings.lockRosterAfterGenerate === true &&
    (tournament.matches?.length ?? 0) > 0;
  const namesEditable = settings.playerNamesEditable !== false;

  const save = useMutation({
    mutationFn: async () => {
      const players = draft.players
        .filter((p) => !p.delete)
        .flatMap((p) => {
          if (p.id) {
            return [
              {
                id: p.id,
                name: p.name.trim(),
                photoUrl: p.photoUrl.trim() || null,
                isCaptain: p.isCaptain,
                isSub: p.isSub,
              },
            ];
          }
          if (p.name.trim()) {
            return [
              {
                name: p.name.trim(),
                photoUrl: p.photoUrl.trim() || null,
                isCaptain: p.isCaptain,
                isSub: p.isSub,
              },
            ];
          }
          return [];
        });

      const deleted = draft.players
        .filter((p) => p.delete && p.id)
        .map((p) => ({ id: p.id!, delete: true }));

      await api(`/tournaments/${tournament.id}/teams/${team.id}/media`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          logoUrl: draft.logoUrl.trim() || null,
          teamPhotoUrl: draft.teamPhotoUrl.trim() || null,
          players: [...players, ...deleted],
        }),
      });
    },
    onSuccess: async () => {
      setMsg('Saved');
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  function patchPlayer(key: string, patch: Partial<PlayerDraft>) {
    setDraft((d) => ({
      ...d,
      players: d.players.map((p) =>
        playerKey(p) === key ? { ...p, ...patch } : p,
      ),
    }));
  }

  function addPlayer() {
    const visible = draft.players.filter((p) => !p.delete);
    const starters = visible.filter((p) => !p.isSub).length;
    setDraft((d) => ({
      ...d,
      players: [
        ...d.players,
        {
          key: `new-${Date.now()}`,
          name: '',
          photoUrl: '',
          isCaptain: visible.length === 0,
          isSub: allowSubs && starters >= limits.starters,
        },
      ],
    }));
  }

  function removePlayer(key: string) {
    setDraft((d) => ({
      ...d,
      players: d.players
        .map((p) =>
          playerKey(p) === key
            ? p.id
              ? { ...p, delete: true }
              : null
            : p,
        )
        .filter(Boolean) as PlayerDraft[],
    }));
  }

  const visiblePlayers = draft.players.filter((p) => !p.delete);

  return (
    <div className="rounded-lg border border-[var(--color-line)] p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-sm font-semibold"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>
          {team.name}
          {visiblePlayers.length > 0 && (
            <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
              {visiblePlayers.length} player
              {visiblePlayers.length === 1 ? '' : 's'}
            </span>
          )}
        </span>
        <span className="text-[var(--color-muted)]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {rosterLocked && (
            <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900">
              Roster locked after bracket generation — you can still update logos
              and photos.
            </p>
          )}
          <ImageUrlField
            label="Team logo"
            hint="Square logo for brackets and share cards"
            value={draft.logoUrl}
            onChange={(v) => setDraft((d) => ({ ...d, logoUrl: v }))}
            token={token}
          />
          <ImageUrlField
            label="Full team photo"
            hint="Group photo for congrats / winner cards"
            value={draft.teamPhotoUrl}
            onChange={(v) => setDraft((d) => ({ ...d, teamPhotoUrl: v }))}
            token={token}
          />

          <div className="space-y-2 border-t border-[var(--color-line)] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label>Players</Label>
                <p className="text-[10px] text-[var(--color-muted)]">
                  {limits.starters} starter{limits.starters === 1 ? '' : 's'}
                  {allowSubs
                    ? ` + up to ${limits.substituteSlots} sub${limits.substituteSlots === 1 ? '' : 's'}`
                    : ''}{' '}
                  · max {limits.maxRoster}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                disabled={rosterLocked || visiblePlayers.length >= limits.maxRoster}
                onClick={addPlayer}
              >
                <Plus className="size-3.5" />
                Add player
              </Button>
            </div>
            {visiblePlayers.length === 0 && (
              <p className="text-xs text-[var(--color-muted)]">
                No players yet — add names for roster display and MVP cards.
              </p>
            )}
            {visiblePlayers.map((p) => (
              <div
                key={playerKey(p)}
                className="flex flex-wrap items-end gap-2 rounded-md bg-[var(--color-surface)] p-2"
              >
                <div className="min-w-[120px] flex-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="mt-1"
                    value={p.name}
                    disabled={rosterLocked || !namesEditable}
                    onChange={(e) =>
                      patchPlayer(playerKey(p), { name: e.target.value })
                    }
                    placeholder="Player name"
                  />
                </div>
                <div className="min-w-[140px] flex-[2]">
                  <ImageUrlField
                    label="Photo"
                    value={p.photoUrl}
                    onChange={(v) =>
                      patchPlayer(playerKey(p), { photoUrl: v })
                    }
                    token={token}
                  />
                </div>
                <label className="flex items-center gap-1 pb-2 text-xs">
                  <input
                    type="checkbox"
                    checked={p.isCaptain}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDraft((d) => ({
                        ...d,
                        players: d.players.map((row) =>
                          row.delete
                            ? row
                            : {
                                ...row,
                                isCaptain:
                                  playerKey(row) === playerKey(p)
                                    ? checked
                                    : checked
                                      ? false
                                      : row.isCaptain,
                              },
                        ),
                      }));
                    }}
                  />
                  Captain
                </label>
                {allowSubs && (
                  <label className="flex items-center gap-1 pb-2 text-xs">
                    <input
                      type="checkbox"
                      checked={p.isSub}
                      onChange={(e) =>
                        patchPlayer(playerKey(p), { isSub: e.target.checked })
                      }
                    />
                    Sub
                  </label>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 text-red-600"
                  disabled={rosterLocked}
                  onClick={() => removePlayer(playerKey(p))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Save {team.name}
          </Button>
          {msg && <p className="text-xs text-[var(--color-muted)]">{msg}</p>}
        </div>
      )}
    </div>
  );
}
