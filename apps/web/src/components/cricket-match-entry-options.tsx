'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CricketScoreboardButton } from '@/components/cricket-scoreboard-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

type InningsDraft = {
  runs: string;
  wickets: string;
  overs: string;
  extras: string;
  allOut: boolean;
};

function emptyInningsDraft(): InningsDraft {
  return {
    runs: '',
    wickets: '',
    overs: '',
    extras: '',
    allOut: false,
  };
}

type Props = {
  slug: string;
  matchId: string;
  token: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  disabled?: boolean;
};

function InningsReportFields({
  title,
  draft,
  onChange,
  disabled,
}: {
  title: string;
  draft: InningsDraft;
  onChange: (patch: Partial<InningsDraft>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Runs</Label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            className="mt-1 text-center font-semibold"
            value={draft.runs}
            onChange={(e) => onChange({ runs: e.target.value })}
            placeholder="0"
            disabled={disabled}
          />
        </div>
        <div>
          <Label className="text-xs">Wickets</Label>
          <Input
            type="number"
            min={0}
            max={10}
            inputMode="numeric"
            className="mt-1 text-center font-semibold"
            value={draft.wickets}
            onChange={(e) => onChange({ wickets: e.target.value })}
            placeholder="0"
            disabled={disabled}
          />
        </div>
        <div>
          <Label className="text-xs">Overs</Label>
          <Input
            type="text"
            inputMode="decimal"
            className="mt-1 text-center font-semibold"
            value={draft.overs}
            onChange={(e) => onChange({ overs: e.target.value })}
            placeholder="20.0"
            disabled={disabled}
          />
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">e.g. 19.4</p>
        </div>
        <div>
          <Label className="text-xs">Extras</Label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            className="mt-1 text-center font-semibold"
            value={draft.extras}
            onChange={(e) => onChange({ extras: e.target.value })}
            placeholder="0"
            disabled={disabled}
          />
        </div>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <input
          type="checkbox"
          checked={draft.allOut}
          onChange={(e) => onChange({ allOut: e.target.checked })}
          disabled={disabled}
        />
        All out
      </label>
    </div>
  );
}

export function CricketMatchEntryOptions({
  slug,
  matchId,
  token,
  homeTeamId,
  awayTeamId,
  homeName,
  awayName,
  disabled = false,
}: Props) {
  const qc = useQueryClient();
  const [firstBattingTeamId, setFirstBattingTeamId] = useState(homeTeamId);
  const [firstInnings, setFirstInnings] = useState(emptyInningsDraft);
  const [secondInnings, setSecondInnings] = useState(emptyInningsDraft);
  const [error, setError] = useState('');

  const firstBattingName =
    firstBattingTeamId === homeTeamId ? homeName : awayName;
  const secondBattingName =
    firstBattingTeamId === homeTeamId ? awayName : homeName;

  const save = useMutation({
    mutationFn: () => {
      const parseNum = (v: string, label: string) => {
        if (v.trim() === '') throw new Error(`${label} is required`);
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${label.toLowerCase()}`);
        return n;
      };

      return api(`/matches/${matchId}/cricket/report`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          firstBattingTeamId,
          firstInnings: {
            runs: parseNum(firstInnings.runs, '1st innings runs'),
            wickets: parseNum(firstInnings.wickets, '1st innings wickets'),
            overs: firstInnings.overs.trim(),
            extras:
              firstInnings.extras.trim() === ''
                ? 0
                : parseNum(firstInnings.extras, '1st innings extras'),
            allOut: firstInnings.allOut,
          },
          secondInnings: {
            runs: parseNum(secondInnings.runs, '2nd innings runs'),
            wickets: parseNum(secondInnings.wickets, '2nd innings wickets'),
            overs: secondInnings.overs.trim(),
            extras:
              secondInnings.extras.trim() === ''
                ? 0
                : parseNum(secondInnings.extras, '2nd innings extras'),
            allOut: secondInnings.allOut,
          },
        }),
      });
    },
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const preview = useMemo(() => {
    const fmt = (d: InningsDraft) =>
      d.runs && d.wickets !== '' && d.overs
        ? `${d.runs}/${d.wickets} (${d.overs} ov)`
        : null;
    const a = fmt(firstInnings);
    const b = fmt(secondInnings);
    if (!a && !b) return null;
    return [a, b].filter(Boolean).join(' · ');
  }, [firstInnings, secondInnings]);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/40 p-3">
      <CricketScoreboardButton slug={slug} matchId={matchId} fullWidth />

      <details className="group rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-surface)] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Enter full match report
            <span className="text-xs font-normal text-[var(--color-muted)] group-open:hidden">
              Show runs, wickets & overs
            </span>
            <span className="hidden text-xs font-normal text-[var(--color-muted)] group-open:inline">
              Hide
            </span>
          </span>
        </summary>

        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <div>
            <Label className="text-xs">Team batting first</Label>
            <select
              className="panel-card field-select mt-1 w-full text-sm"
              value={firstBattingTeamId}
              onChange={(e) => setFirstBattingTeamId(e.target.value)}
              disabled={disabled || save.isPending}
            >
              <option value={homeTeamId}>{homeName}</option>
              <option value={awayTeamId}>{awayName}</option>
            </select>
          </div>

          <InningsReportFields
            title={`1st innings — ${firstBattingName}`}
            draft={firstInnings}
            onChange={(patch) => setFirstInnings((d) => ({ ...d, ...patch }))}
            disabled={disabled || save.isPending}
          />

          <InningsReportFields
            title={`2nd innings — ${secondBattingName}`}
            draft={secondInnings}
            onChange={(patch) => setSecondInnings((d) => ({ ...d, ...patch }))}
            disabled={disabled || save.isPending}
          />

          {preview && (
            <p className="text-center text-sm font-semibold text-[var(--color-ink)]">
              {preview}
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={disabled || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save match report'}
          </Button>
        </div>
      </details>
    </div>
  );
}
