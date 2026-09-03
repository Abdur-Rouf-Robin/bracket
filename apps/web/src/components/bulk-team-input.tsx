'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** Parse pasted text: one team per line, optional "Team | Player1, Player2" */
export function parseBulkTeams(text: string): { name: string; players: string[] }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf('|');
      if (pipe === -1) {
        return { name: line, players: [] };
      }
      const name = line.slice(0, pipe).trim();
      const players = line
        .slice(pipe + 1)
        .split(/[,;]/)
        .map((p) => p.trim())
        .filter(Boolean);
      return { name: name || line, players };
    });
}

export function BulkTeamInput({
  onApply,
  maxCount = 512,
  showPlayerHint = false,
}: {
  onApply: (teams: { name: string; players: string[] }[]) => void;
  maxCount?: number;
  showPlayerHint?: boolean;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Paste list
      </Button>
    );
  }

  const preview = parseBulkTeams(text);
  const overLimit = preview.length > maxCount;

  return (
    <div className="rounded-xl border border-dashed border-[var(--color-accent)]/40 bg-[var(--color-surface)]/50 p-4">
      <Label>Paste participants (one per line)</Label>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        One name per line.
        {showPlayerHint &&
          ' For teams use: Team Name | Player1, Player2, Player3'}
      </p>
      <textarea
        className="panel-card mt-2 min-h-[120px] w-full resize-y rounded-lg px-3 py-2 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          showPlayerHint
            ? 'Alpha Squad | Alex, Sam\nBeta FC | Jo, Kim\nCharlie'
            : 'Team Alpha\nTeam Beta\nTeam Charlie'
        }
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!preview.length || overLimit}
          onClick={() => {
            onApply(preview.slice(0, maxCount));
            setText('');
            setOpen(false);
          }}
        >
          Apply {preview.length ? `(${preview.length})` : ''}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {overLimit && (
          <span className="text-xs text-red-600">
            Max {maxCount} participants
          </span>
        )}
      </div>
    </div>
  );
}
