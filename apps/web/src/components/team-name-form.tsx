'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type NamedTeam = { name: string; players: string[] };

export function TeamNameForm({
  teams,
  maxCount = 512,
  onChange,
}: {
  teams: NamedTeam[];
  maxCount?: number;
  onChange: (teams: NamedTeam[]) => void;
}) {
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<string[]>(['']);
  const [error, setError] = useState('');

  function addTeam() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a team name');
      return;
    }
    if (teams.length >= maxCount) {
      setError(`You can add up to ${maxCount} teams`);
      return;
    }
    onChange([
      ...teams,
      {
        name: trimmed,
        players: players.map((p) => p.trim()).filter(Boolean),
      },
    ]);
    setName('');
    setPlayers(['']);
    setError('');
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <Label htmlFor="form-team-name">Team name</Label>
        <Input
          id="form-team-name"
          className="mt-1"
          value={name}
          placeholder="Night FC"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTeam();
            }
          }}
        />
        <Label className="mt-4">Players (optional)</Label>
        <div className="mt-1 space-y-2">
          {players.map((player, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={player}
                placeholder={`Player ${index + 1}`}
                onChange={(e) => {
                  const next = [...players];
                  next[index] = e.target.value;
                  setPlayers(next);
                }}
              />
              {players.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 text-red-600"
                  onClick={() => setPlayers(players.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setPlayers([...players, ''])}
          >
            + Add player
          </Button>
          <Button type="button" onClick={addTeam} disabled={teams.length >= maxCount}>
            Add team
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div>
        <p className="text-sm text-[var(--color-muted)]">
          {teams.length} team{teams.length === 1 ? '' : 's'} added
        </p>
        {teams.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Fill in a team name and click Add team. Repeat for each team.
          </p>
        ) : (
          <ul className="mt-2 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {teams.map((team, index) => (
              <li
                key={`${team.name}-${index}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-line)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <span className="mr-2 text-xs text-[var(--color-muted)]">#{index + 1}</span>
                    {team.name}
                  </p>
                  {team.players.length > 0 && (
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {team.players.join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 text-red-600"
                  onClick={() => onChange(teams.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
