'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import type { TournamentSettings } from '@bracket/shared';
import {
  DEFAULT_STANDINGS_COLUMNS,
  DEFAULT_STANDINGS_CRITERIA,
  RANK_BY_OPTIONS,
  STANDINGS_COLUMNS,
  STANDINGS_COLUMNS_META,
  STANDINGS_CRITERIA_META,
  describeStandingsCriteria,
  placementMatchOptions,
  relevantCriteriaFor,
  type StandingsColumn,
  type StandingsCriterion,
} from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import type { StandingAdjustment } from '@/lib/types-platform';

type Draft = {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  rankBy: string;
  standingsCriteria: StandingsCriterion[];
  standingsColumns: StandingsColumn[];
  setBasedScoring: boolean;
  setsBestOf: number;
  placementMatchesThrough: number;
  consolationBracket: boolean;
  swissMode: 'CLASSIC' | 'POTS';
  splitParticipantsStartInLosers: boolean;
  losersStartTeamIds: string[];
  bracketNames: { winners?: string; losers?: string; consolation?: string; final?: string };
  breakTiesWithPlacement: boolean;
};

function draftFrom(t: Tournament): Draft {
  const s = (t.settings ?? {}) as Partial<TournamentSettings>;
  return {
    pointsWin: t.pointsWin ?? 3,
    pointsDraw: t.pointsDraw ?? 1,
    pointsLoss: s.pointsLoss ?? 0,
    rankBy: s.rankBy ?? 'TOURNAMENT_POINTS',
    standingsCriteria: (s.standingsCriteria as StandingsCriterion[] | undefined) ?? [
      ...DEFAULT_STANDINGS_CRITERIA,
    ],
    standingsColumns: (s.standingsColumns as StandingsColumn[] | undefined) ?? [
      ...DEFAULT_STANDINGS_COLUMNS,
    ],
    setBasedScoring: s.setBasedScoring ?? false,
    setsBestOf: s.setsBestOf ?? 3,
    placementMatchesThrough:
      s.placementMatchesThrough ?? (s.breakTiesWithPlacement ? 3 : 0),
    consolationBracket: s.consolationBracket ?? false,
    swissMode: (s.swissMode as 'CLASSIC' | 'POTS' | undefined) ?? 'CLASSIC',
    splitParticipantsStartInLosers: s.splitParticipantsStartInLosers ?? false,
    losersStartTeamIds: (s.losersStartTeamIds as string[] | undefined) ?? [],
    bracketNames: (s.bracketNames as Draft['bracketNames'] | undefined) ?? {},
    breakTiesWithPlacement: s.breakTiesWithPlacement ?? false,
  };
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-[var(--color-muted)]">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SortableItem({
  id,
  onRemove,
  children,
  disabledRemove,
}: {
  id: string;
  onRemove?: () => void;
  children: React.ReactNode;
  disabledRemove?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-2 py-2 ${
        isDragging ? 'opacity-70 shadow-lg' : ''
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabledRemove}
          className="text-[var(--color-muted)] hover:text-red-500 disabled:opacity-30"
          aria-label="Remove"
        >
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}

function SortableList<T extends string>({
  items,
  onChange,
  render,
  locked,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  render: (item: T, index: number) => React.ReactNode;
  locked?: (item: T) => boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.indexOf(active.id as T);
    const to = items.indexOf(over.id as T);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(items, from, to));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ol className="grid gap-1.5">
          {items.map((item, i) => (
            <SortableItem
              key={item}
              id={item}
              disabledRemove={locked?.(item)}
              onRemove={() => onChange(items.filter((x) => x !== item))}
            >
              {render(item, i)}
            </SortableItem>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

export function StandingsSettingsPanel({
  tournament,
  token,
  mode,
  sub,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  sub: string;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(tournament));
  const [dirty, setDirty] = useState(false);
  const [addCriterion, setAddCriterion] = useState('');
  const [addColumn, setAddColumn] = useState('');

  useEffect(() => {
    if (!dirty) setDraft(draftFrom(tournament));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament]);

  const hasMatches = (tournament.matches?.length ?? 0) > 0;
  const teamCount = tournament.teams?.length ?? 0;
  const settings = (tournament.settings ?? {}) as Partial<TournamentSettings>;
  const format =
    tournament.format ??
    (settings.stageMode === 'TWO_STAGE'
      ? 'GROUPS_KNOCKOUT'
      : (settings.singleStageFormat as string | undefined) ?? null);
  const isSE = format === 'SINGLE_ELIMINATION';
  const isDE = format === 'DOUBLE_ELIMINATION';
  const isGK = format === 'GROUPS_KNOCKOUT';
  const isSwiss = format === 'SWISS';
  const isKnockout = isSE || isDE || isGK;
  const isCricket = (tournament.game?.name ?? '').toLowerCase().includes('cricket');

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        pointsWin: draft.pointsWin,
        pointsDraw: draft.pointsDraw,
        settings: {
          pointsLoss: draft.pointsLoss,
          rankBy: draft.rankBy,
          standingsCriteria: draft.standingsCriteria,
          standingsColumns: draft.standingsColumns,
          setBasedScoring: draft.setBasedScoring,
          setsBestOf: draft.setsBestOf,
          placementMatchesThrough: draft.placementMatchesThrough,
          breakTiesWithPlacement: draft.placementMatchesThrough >= 3,
          consolationBracket: draft.consolationBracket,
          swissMode: draft.swissMode,
          splitParticipantsStartInLosers: draft.splitParticipantsStartInLosers,
          losersStartTeamIds: draft.losersStartTeamIds,
          bracketNames: draft.bracketNames,
        },
      };
      await api(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      });
      if (hasMatches) {
        await api(`/tournaments/${tournament.id}/standings/recompute`, {
          method: 'POST',
          token,
        }).catch(() => undefined);
      }
    },
    onSuccess: () => {
      setDirty(false);
      toast.success('Standings settings saved');
      qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save settings'),
  });

  const adjustments = useQuery({
    queryKey: ['standing-adjustments', tournament.id],
    queryFn: () =>
      api<StandingAdjustment[]>(`/tournaments/${tournament.id}/standings/adjustments`, {
        token,
      }),
  });

  const [adjTeam, setAdjTeam] = useState('');
  const [adjPoints, setAdjPoints] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const addAdjustment = useMutation({
    mutationFn: async () => {
      const points = Number(adjPoints);
      if (!adjTeam) throw new Error('Pick a team');
      if (!Number.isInteger(points) || points === 0) throw new Error('Enter a non-zero whole number');
      if (!adjReason.trim()) throw new Error('Give a reason (shown to participants)');
      await api(`/tournaments/${tournament.id}/standings/adjustments`, {
        method: 'POST',
        token,
        body: JSON.stringify({ teamId: adjTeam, points, reason: adjReason.trim() }),
      });
    },
    onSuccess: () => {
      setAdjPoints('');
      setAdjReason('');
      toast.success('Adjustment applied');
      qc.invalidateQueries({ queryKey: ['standing-adjustments', tournament.id] });
      qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAdjustment = useMutation({
    mutationFn: (id: string) =>
      api(`/tournaments/${tournament.id}/standings/adjustments/${id}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standing-adjustments', tournament.id] });
      qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const availableCriteria = useMemo(
    () =>
      relevantCriteriaFor({
        format,
        setBasedScoring: draft.setBasedScoring,
        isCricket,
      }).filter((c) => !draft.standingsCriteria.includes(c)),
    [format, draft.setBasedScoring, draft.standingsCriteria, isCricket],
  );
  const availableColumns = STANDINGS_COLUMNS.filter(
    (c) => !draft.standingsColumns.includes(c),
  );

  const primaryLabel =
    RANK_BY_OPTIONS.find((o) => o.value === draft.rankBy)?.label ?? 'points';
  const explanation = describeStandingsCriteria(
    primaryLabel.replace(/\s*\(.*\)$/, '').toLowerCase(),
    draft.standingsCriteria,
  );

  const placementOptions = useMemo(() => {
    const opts = placementMatchOptions(Math.max(teamCount, 2));
    // In double elimination 3rd/4th are already decided by the losers final.
    return isDE ? opts.filter((o) => o.value !== 3) : opts;
  }, [teamCount, isDE]);

  if (mode !== 'manage' && !tournament.isOwner && !tournament.canManage) return null;

  const structuralWarning = hasMatches ? (
    <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      Bracket already generated — changing this requires resetting and regenerating the bracket
      to take effect.
    </p>
  ) : null;

  return (
    <div className="grid gap-6" data-sub={sub}>
      {/* Points & ranking */}
      <section className="gaming-card rounded-xl p-5">
        <SectionTitle
          title="Points & ranking"
          hint="How results turn into points and what decides the order."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['pointsWin', 'Points for a win'],
              ['pointsDraw', 'Points for a draw'],
              ['pointsLoss', 'Points for a loss'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm">
              <span className="font-medium">{label}</span>
              <Input
                type="number"
                min={key === 'pointsLoss' ? -10 : 0}
                max={key === 'pointsLoss' ? 10 : 99}
                value={draft[key]}
                onChange={(e) => update(key, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        <label className="mt-4 grid gap-1 text-sm">
          <span className="font-medium">Rank by</span>
          <select
            className="field-select"
            value={draft.rankBy}
            onChange={(e) => update('rankBy', e.target.value)}
          >
            {RANK_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Tiebreakers */}
      <section className="gaming-card rounded-xl p-5">
        <SectionTitle
          title="Tiebreak criteria"
          hint="Applied in order when teams are level on the primary ranking. Drag to reorder."
        />
        <SortableList
          items={draft.standingsCriteria}
          onChange={(next) => update('standingsCriteria', next)}
          render={(c, i) => {
            const meta = STANDINGS_CRITERIA_META[c];
            return (
              <div className="flex items-baseline gap-2">
                <span className="w-5 text-xs tabular-nums text-[var(--color-muted)]">{i + 1}.</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {meta.label}
                    {meta.hint && (
                      <span className="ml-2 rounded-full border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                        {meta.hint}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{meta.description}</p>
                </div>
              </div>
            );
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="field-select flex-1"
            value={addCriterion}
            onChange={(e) => setAddCriterion(e.target.value)}
          >
            <option value="">Add a criterion…</option>
            {availableCriteria.map((c) => (
              <option key={c} value={c}>
                {STANDINGS_CRITERIA_META[c].label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!addCriterion}
            onClick={() => {
              if (!addCriterion) return;
              update('standingsCriteria', [
                ...draft.standingsCriteria,
                addCriterion as StandingsCriterion,
              ]);
              setAddCriterion('');
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
        <p className="mt-3 text-xs italic text-[var(--color-muted)]">{explanation}</p>
      </section>

      {/* Columns */}
      <section className="gaming-card rounded-xl p-5">
        <SectionTitle
          title="Table columns"
          hint="Choose which columns appear on the standings table and in what order."
        />
        <SortableList
          items={draft.standingsColumns}
          onChange={(next) => update('standingsColumns', next)}
          locked={(c) => !!STANDINGS_COLUMNS_META[c].locked}
          render={(c) => {
            const meta = STANDINGS_COLUMNS_META[c];
            return (
              <div className="flex items-center gap-2">
                <span className="w-12 rounded bg-[var(--color-line)]/40 px-1.5 py-0.5 text-center text-xs font-semibold">
                  {meta.short}
                </span>
                <span className="text-sm">{meta.label}</span>
                <span className="hidden text-xs text-[var(--color-muted)] sm:inline">
                  — {meta.description}
                </span>
              </div>
            );
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="field-select flex-1"
            value={addColumn}
            onChange={(e) => setAddColumn(e.target.value)}
          >
            <option value="">Add a column…</option>
            {availableColumns.map((c) => (
              <option key={c} value={c}>
                {STANDINGS_COLUMNS_META[c].label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!addColumn}
            onClick={() => {
              if (!addColumn) return;
              update('standingsColumns', [
                ...draft.standingsColumns,
                addColumn as StandingsColumn,
              ]);
              setAddColumn('');
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </section>

      {/* Scoring */}
      <section className="gaming-card rounded-xl p-5">
        <SectionTitle title="Match scoring" />
        <Row
          label="Set-based scoring"
          hint="Tennis, volleyball, padel, table tennis: enter each set; sets won decide the match."
        >
          <Switch
            checked={draft.setBasedScoring}
            onCheckedChange={(v) => update('setBasedScoring', v)}
          />
        </Row>
        {draft.setBasedScoring && (
          <label className="mt-1 grid gap-1 text-sm">
            <span className="font-medium">Sets — best of</span>
            <select
              className="field-select w-40"
              value={draft.setsBestOf}
              onChange={(e) => update('setsBestOf', Number(e.target.value))}
            >
              {[1, 3, 5, 7, 9].map((n) => (
                <option key={n} value={n}>
                  Best of {n} ({Math.ceil(n / 2)} to win)
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {/* Format options */}
      {(isKnockout || isSwiss) && (
        <section className="gaming-card rounded-xl p-5">
          <SectionTitle
            title="Bracket options"
            hint="Structural options are applied when the bracket is generated."
          />
          {(isSE || isDE || isGK) && (
            <label className="grid gap-1 py-2 text-sm">
              <span className="font-medium">Placement matches</span>
              <span className="text-xs text-[var(--color-muted)]">
                Extra matches to decide 3rd place and lower rankings (Challonge style).
              </span>
              <select
                className="field-select w-full sm:w-72"
                value={draft.placementMatchesThrough}
                onChange={(e) => update('placementMatchesThrough', Number(e.target.value))}
              >
                {placementOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(isSE || isGK) && (
            <Row
              label="Consolation bracket"
              hint="Losers of the first knockout round play a separate cup with its own champion."
            >
              <Switch
                checked={draft.consolationBracket}
                onCheckedChange={(v) => update('consolationBracket', v)}
              />
            </Row>
          )}
          {isSwiss && (
            <div className="py-2">
              <p className="text-sm font-medium">Swiss mode</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['CLASSIC', 'Classic', 'Pair round by round based on current standings.'],
                    ['POTS', 'Pots (UCL style)', 'Draw every fixture up-front from seeded pots.'],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update('swissMode', value)}
                    className={`choice-btn rounded-lg px-3 py-2 text-left ${
                      draft.swissMode === value
                        ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]'
                        : 'border border-[var(--color-line)]'
                    }`}
                  >
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-[var(--color-muted)]">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {isDE && (
            <>
              <Row
                label="Split participants"
                hint="Some participants start directly in the losers bracket."
              >
                <Switch
                  checked={draft.splitParticipantsStartInLosers}
                  onCheckedChange={(v) => update('splitParticipantsStartInLosers', v)}
                />
              </Row>
              {draft.splitParticipantsStartInLosers && (
                <div className="mt-1 rounded-lg border border-[var(--color-line)] p-3">
                  <p className="mb-2 text-xs text-[var(--color-muted)]">
                    Select who starts in the losers bracket ({draft.losersStartTeamIds.length}
                    /{Math.max(0, teamCount - 1)} max).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tournament.teams.map((team) => {
                      const on = draft.losersStartTeamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          disabled={hasMatches}
                          onClick={() =>
                            update(
                              'losersStartTeamIds',
                              on
                                ? draft.losersStartTeamIds.filter((x) => x !== team.id)
                                : draft.losersStartTeamIds.length < teamCount - 1
                                  ? [...draft.losersStartTeamIds, team.id]
                                  : draft.losersStartTeamIds,
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-xs disabled:opacity-50 ${
                            on
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'border border-[var(--color-line)]'
                          }`}
                        >
                          {team.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['winners', isDE ? 'Winners bracket name' : 'Main bracket name'],
                ...(isDE ? [['losers', 'Losers bracket name'] as const] : []),
                ...(draft.consolationBracket
                  ? [['consolation', 'Consolation bracket name'] as const]
                  : []),
                ['final', isDE ? 'Grand final name' : 'Final name'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="grid gap-1 text-sm">
                <span className="font-medium">{label}</span>
                <Input
                  maxLength={40}
                  placeholder={
                    key === 'winners'
                      ? isDE
                        ? 'Winners'
                        : 'Bracket'
                      : key === 'losers'
                        ? 'Losers'
                        : key === 'consolation'
                          ? 'Consolation'
                          : isDE
                            ? 'Grand Final'
                            : 'Final'
                  }
                  value={draft.bracketNames[key] ?? ''}
                  onChange={(e) =>
                    update('bracketNames', { ...draft.bracketNames, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          {structuralWarning}
        </section>
      )}

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-[var(--color-muted)]">Unsaved changes</span>}
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setDraft(draftFrom(tournament));
            setDirty(false);
          }}
        >
          Discard
        </Button>
        <Button type="button" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
          Save changes
        </Button>
      </div>

      {/* Manual adjustments */}
      <section className="gaming-card rounded-xl p-5">
        <SectionTitle
          title="Manual adjustments"
          hint="Add or deduct points (sanctions, bonuses). Shown publicly with the reason."
        />
        <div className="grid gap-2 sm:grid-cols-[1fr_6rem_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium">Team</span>
            <select
              className="field-select"
              value={adjTeam}
              onChange={(e) => setAdjTeam(e.target.value)}
            >
              <option value="">Select team…</option>
              {tournament.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium">± Points</span>
            <Input
              type="number"
              step={1}
              placeholder="-3"
              value={adjPoints}
              onChange={(e) => setAdjPoints(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium">Reason</span>
            <Input
              maxLength={300}
              placeholder="e.g. Fielded ineligible player"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
            />
          </label>
          <Button
            type="button"
            loading={addAdjustment.isPending}
            onClick={() => addAdjustment.mutate()}
          >
            <Plus className="size-4" /> Apply
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {adjustments.isLoading ? (
            <p className="text-xs text-[var(--color-muted)]">Loading…</p>
          ) : !adjustments.data?.length ? (
            <p className="text-xs text-[var(--color-muted)]">No adjustments yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="py-1.5">Team</th>
                  <th className="py-1.5 text-right">Points</th>
                  <th className="py-1.5">Reason</th>
                  <th className="py-1.5">When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {adjustments.data.map((a) => (
                  <tr key={a.id} className="border-t border-[var(--color-line)]">
                    <td className="py-1.5 font-medium">
                      {a.team?.name ??
                        tournament.teams.find((t) => t.id === a.teamId)?.name ??
                        'Team'}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        a.points > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {a.points > 0 ? `+${a.points}` : a.points}
                    </td>
                    <td className="py-1.5 text-[var(--color-muted)]">{a.reason}</td>
                    <td className="py-1.5 text-xs text-[var(--color-muted)]">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        className="text-[var(--color-muted)] hover:text-red-500"
                        onClick={() => removeAdjustment.mutate(a.id)}
                        aria-label="Remove adjustment"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
