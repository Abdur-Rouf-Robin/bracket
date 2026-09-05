'use client';

import { summarizeSets, type MatchEntryMode, type MatchMeta } from '@bracket/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export type SetDraft = { home: string; away: string };

export type GameMatchDraft = {
  homeScore: string;
  awayScore: string;
  homePercent: string;
  awayPercent: string;
  etHomeScore: string;
  etAwayScore: string;
  penHomeScore: string;
  penAwayScore: string;
  attackStartAt: string;
  warHours: string;
  htHomeScore: string;
  htAwayScore: string;
  homeMapsWon: string;
  awayMapsWon: string;
  /** Per-set game scores when the tournament uses set-based scoring. */
  sets: SetDraft[];
};

export function emptyGameMatchDraft(): GameMatchDraft {
  return {
    homeScore: '',
    awayScore: '',
    homePercent: '',
    awayPercent: '',
    etHomeScore: '',
    etAwayScore: '',
    penHomeScore: '',
    penAwayScore: '',
    attackStartAt: '',
    warHours: '24',
    htHomeScore: '',
    htAwayScore: '',
    homeMapsWon: '',
    awayMapsWon: '',
    sets: [],
  };
}

/** Rows with both scores filled, as numbers, ready for `matchResultSchema.sets`. */
export function setsFromDraft(sets: SetDraft[]): { home: number; away: number }[] {
  return sets
    .filter((s) => s.home !== '' && s.away !== '')
    .map((s) => ({ home: Number(s.home), away: Number(s.away) }))
    .filter((s) => !Number.isNaN(s.home) && !Number.isNaN(s.away));
}

export function setDraftsFromMatch(sets: { home: number; away: number }[] | null | undefined): SetDraft[] {
  return (sets ?? []).map((s) => ({ home: String(s.home), away: String(s.away) }));
}

type Props = {
  mode: MatchEntryMode;
  homeName: string;
  awayName: string;
  draft: GameMatchDraft;
  onChange: (patch: Partial<GameMatchDraft>) => void;
  showEtPen?: boolean;
  knockoutExtraTime?: boolean;
  knockoutPenalties?: boolean;
  /** settings.setBasedScoring — replaces the plain score inputs with per-set rows. */
  setBasedScoring?: boolean;
  /** settings.setsBestOf (3, 5, …) — caps the number of set rows. */
  setsBestOf?: number | null;
};

export function GameMatchEntryFields({
  mode,
  homeName,
  awayName,
  draft,
  onChange,
  showEtPen,
  knockoutExtraTime,
  knockoutPenalties,
  setBasedScoring,
  setsBestOf,
}: Props) {
  if (mode === 'cricket') {
    return (
      <p className="text-xs text-[var(--color-muted)]">
        Use the cricket scoreboard link above for ball-by-ball scoring.
      </p>
    );
  }

  if (setBasedScoring) {
    return (
      <SetsEntryFields
        homeName={homeName}
        awayName={awayName}
        sets={draft.sets}
        bestOf={setsBestOf ?? null}
        onChange={(sets) => onChange({ sets })}
      />
    );
  }

  if (mode === 'coc-war') {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreField label={`${homeName} — stars (0–3)`} value={draft.homeScore} onChange={(v) => onChange({ homeScore: v })} max={3} />
          <ScoreField label={`${awayName} — stars (0–3)`} value={draft.awayScore} onChange={(v) => onChange({ awayScore: v })} max={3} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreField label={`${homeName} — destruction %`} value={draft.homePercent} onChange={(v) => onChange({ homePercent: v })} max={100} />
          <ScoreField label={`${awayName} — destruction %`} value={draft.awayPercent} onChange={(v) => onChange({ awayPercent: v })} max={100} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Attack window start</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={draft.attackStartAt}
              onChange={(e) => onChange({ attackStartAt: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">War duration (hours)</Label>
            <Input
              type="number"
              min={1}
              max={48}
              className="mt-1"
              value={draft.warHours}
              onChange={(e) => onChange({ warHours: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Winner: most stars, then higher destruction %. Ties can be broken manually.
        </p>
      </div>
    );
  }

  if (mode === 'football') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <ScoreField label={homeName} value={draft.homeScore} onChange={(v) => onChange({ homeScore: v })} large />
          <span className="pb-2 text-xl font-light text-[var(--color-muted)]">–</span>
          <ScoreField label={awayName} value={draft.awayScore} onChange={(v) => onChange({ awayScore: v })} large />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreField label={`${homeName} HT`} value={draft.htHomeScore} onChange={(v) => onChange({ htHomeScore: v })} hint="Half-time (optional)" />
          <ScoreField label={`${awayName} HT`} value={draft.htAwayScore} onChange={(v) => onChange({ htAwayScore: v })} hint="Half-time (optional)" />
        </div>
        {showEtPen && (
          <EtPenFields
            homeName={homeName}
            awayName={awayName}
            draft={draft}
            onChange={onChange}
            knockoutExtraTime={knockoutExtraTime}
            knockoutPenalties={knockoutPenalties}
          />
        )}
      </div>
    );
  }

  if (mode === 'set-sport') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <ScoreField label={`${homeName} sets`} value={draft.homeScore} onChange={(v) => onChange({ homeScore: v })} large max={5} />
          <span className="pb-2 text-xl font-light text-[var(--color-muted)]">–</span>
          <ScoreField label={`${awayName} sets`} value={draft.awayScore} onChange={(v) => onChange({ awayScore: v })} large max={5} />
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Best of 3 or 5 — enter sets won. Standings use set win % and set difference.
        </p>
      </div>
    );
  }

  if (mode === 'esports-series') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <ScoreField label={`${homeName} maps won`} value={draft.homeScore} onChange={(v) => onChange({ homeScore: v })} large />
          <span className="pb-2 text-xl font-light text-[var(--color-muted)]">–</span>
          <ScoreField label={`${awayName} maps won`} value={draft.awayScore} onChange={(v) => onChange({ awayScore: v })} large />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreField label={`${homeName} series score`} value={draft.homeMapsWon} onChange={(v) => onChange({ homeMapsWon: v })} hint="Optional if using BoX" />
          <ScoreField label={`${awayName} series score`} value={draft.awayMapsWon} onChange={(v) => onChange({ awayMapsWon: v })} hint="Optional if using BoX" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <ScoreField label={homeName} value={draft.homeScore} onChange={(v) => onChange({ homeScore: v })} large />
      <span className="pb-2 text-xl font-light text-[var(--color-muted)]">–</span>
      <ScoreField label={awayName} value={draft.awayScore} onChange={(v) => onChange({ awayScore: v })} large />
    </div>
  );
}

export function buildMatchMetaFromDraft(
  mode: MatchEntryMode,
  draft: GameMatchDraft,
): MatchMeta | null {
  if (mode === 'coc-war') {
    return {
      attackStartAt: draft.attackStartAt
        ? new Date(draft.attackStartAt).toISOString()
        : null,
      warHours: draft.warHours === '' ? 24 : Number(draft.warHours),
    };
  }
  if (mode === 'football') {
    const htHome = draft.htHomeScore === '' ? null : Number(draft.htHomeScore);
    const htAway = draft.htAwayScore === '' ? null : Number(draft.htAwayScore);
    if (htHome == null && htAway == null) return null;
    return { htHomeScore: htHome, htAwayScore: htAway };
  }
  if (mode === 'esports-series') {
    const hm = draft.homeMapsWon === '' ? null : Number(draft.homeMapsWon);
    const am = draft.awayMapsWon === '' ? null : Number(draft.awayMapsWon);
    if (hm == null && am == null) return null;
    return { homeMapsWon: hm, awayMapsWon: am };
  }
  return null;
}

/**
 * Per-set score rows (tennis / volleyball / table tennis). Rows can be added up to
 * `bestOf`; the sets-won tally and validation message update live.
 */
export function SetsEntryFields({
  homeName,
  awayName,
  sets,
  bestOf,
  onChange,
}: {
  homeName: string;
  awayName: string;
  sets: SetDraft[];
  bestOf: number | null;
  onChange: (sets: SetDraft[]) => void;
}) {
  const needed = bestOf && bestOf > 0 ? Math.ceil(bestOf / 2) : null;
  const rows = sets.length ? sets : [{ home: '', away: '' }];
  const numeric = setsFromDraft(rows);
  const summary = numeric.length ? summarizeSets(numeric, bestOf) : null;
  const decided = summary?.error == null && summary?.winner != null;
  const canAdd = (bestOf == null || rows.length < bestOf) && !decided;

  const update = (index: number, patch: Partial<SetDraft>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  };
  const remove = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : [{ home: '', away: '' }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span>
          {bestOf ? `Best of ${bestOf} — first to ${needed} sets` : 'Enter each set score'}
        </span>
        <span className="font-semibold tabular-nums text-[var(--color-ink)]">
          Sets {summary?.homeSetsWon ?? 0}–{summary?.awaySetsWon ?? 0}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2">
        <span />
        <span className="truncate text-center text-[11px] font-semibold">{homeName}</span>
        <span />
        <span className="truncate text-center text-[11px] font-semibold">{awayName}</span>
        <span />
        {rows.map((row, i) => (
          <SetRow
            key={i}
            index={i}
            row={row}
            onChange={(patch) => update(i, patch)}
            onRemove={rows.length > 1 ? () => remove(i) : undefined}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canAdd && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChange([...rows, { home: '', away: '' }])}
          >
            + Add set
          </Button>
        )}
        {summary?.error && numeric.length === rows.length && (
          <span className="text-xs text-amber-700">{summary.error}</span>
        )}
        {decided && (
          <span className="text-xs font-semibold text-emerald-700">
            {summary!.winner === 'home' ? homeName : awayName} wins the match
          </span>
        )}
      </div>
    </div>
  );
}

function SetRow({
  index,
  row,
  onChange,
  onRemove,
}: {
  index: number;
  row: SetDraft;
  onChange: (patch: Partial<SetDraft>) => void;
  onRemove?: () => void;
}) {
  return (
    <>
      <span className="text-[11px] font-semibold text-[var(--color-muted)]">Set {index + 1}</span>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        className="text-center font-bold"
        value={row.home}
        onChange={(e) => onChange({ home: e.target.value })}
        placeholder="0"
        aria-label={`Set ${index + 1} home score`}
      />
      <span className="text-center text-[var(--color-muted)]">–</span>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        className="text-center font-bold"
        value={row.away}
        onChange={(e) => onChange({ away: e.target.value })}
        placeholder="0"
        aria-label={`Set ${index + 1} away score`}
      />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-[var(--color-muted)] hover:text-red-600"
          aria-label={`Remove set ${index + 1}`}
        >
          ✕
        </button>
      ) : (
        <span />
      )}
    </>
  );
}

function ScoreField({
  label,
  value,
  onChange,
  max,
  large,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  large?: boolean;
  hint?: string;
}) {
  return (
    <div className={large ? 'min-w-[72px] flex-1' : ''}>
      <Label className="text-xs">{label}</Label>
      {hint && <p className="text-[10px] text-[var(--color-muted)]">{hint}</p>}
      <Input
        type="number"
        min={0}
        max={max}
        inputMode="numeric"
        className={`mt-1 text-center font-bold ${large ? 'text-lg' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}

function EtPenFields({
  homeName,
  awayName,
  draft,
  onChange,
  knockoutExtraTime,
  knockoutPenalties,
}: {
  homeName: string;
  awayName: string;
  draft: GameMatchDraft;
  onChange: (patch: Partial<GameMatchDraft>) => void;
  knockoutExtraTime?: boolean;
  knockoutPenalties?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-line)] p-3">
      {knockoutExtraTime && (
        <div>
          <p className="text-xs font-semibold text-[var(--color-muted)]">Extra time</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <ScoreField label={`${homeName} ET`} value={draft.etHomeScore} onChange={(v) => onChange({ etHomeScore: v })} />
            <ScoreField label={`${awayName} ET`} value={draft.etAwayScore} onChange={(v) => onChange({ etAwayScore: v })} />
          </div>
        </div>
      )}
      {knockoutPenalties && (
        <div>
          <p className="text-xs font-semibold text-[var(--color-muted)]">Penalties</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <ScoreField label={`${homeName} pens`} value={draft.penHomeScore} onChange={(v) => onChange({ penHomeScore: v })} />
            <ScoreField label={`${awayName} pens`} value={draft.penAwayScore} onChange={(v) => onChange({ penAwayScore: v })} />
          </div>
        </div>
      )}
    </div>
  );
}
