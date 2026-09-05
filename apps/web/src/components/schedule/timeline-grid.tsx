'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { ScheduleConflictDto, ScheduleMatchDto, ScheduleStationDto } from '@bracket/shared';
import { cn } from '@/lib/utils';
import { MatchCard } from './match-card';
import { fmtTime } from './schedule-shared';

const UNASSIGNED = '__unassigned__';
const TRAY = '__unscheduled_tray__';

export type DropTarget = { startAt: string | null; stationId: string | null };

function cellId(startAt: string, stationId: string | null) {
  return `cell|${startAt}|${stationId ?? UNASSIGNED}`;
}

function parseCellId(id: string): DropTarget | null {
  if (id === TRAY) return { startAt: null, stationId: null };
  const [kind, startAt, station] = id.split('|');
  if (kind !== 'cell' || !startAt) return null;
  return { startAt, stationId: station === UNASSIGNED ? null : station };
}

function DraggableCard({
  match,
  editable,
  children,
}: {
  match: ScheduleMatchDto;
  editable: boolean;
  children: (handle: Record<string, unknown>) => React.ReactNode;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: match.id,
    disabled: !editable || match.status === 'COMPLETED',
  });
  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-30')}>
      {children({ ...listeners, ...attributes })}
    </div>
  );
}

function DropCell({
  id,
  editable,
  className,
  children,
}: {
  id: string;
  editable: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !editable });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[4.5rem] rounded-md border border-dashed p-1 transition',
        !className && 'space-y-1.5',
        editable ? 'border-[var(--color-line)]/70' : 'border-transparent',
        isOver && 'border-[var(--color-accent)] bg-[var(--color-accent)]/10',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TimelineGrid({
  matches,
  stations,
  tz,
  editable,
  conflicts = [],
  showReferee = false,
  extraTimes = [],
  unscheduled = [],
  onCardClick,
  onDrop,
  compact = false,
}: {
  matches: ScheduleMatchDto[];
  stations: ScheduleStationDto[];
  tz: string;
  editable: boolean;
  conflicts?: ScheduleConflictDto[];
  showReferee?: boolean;
  /** Extra ISO start times to render as empty rows (drop targets). */
  extraTimes?: string[];
  /** Unscheduled matches shown in a drag tray (manage mode). */
  unscheduled?: ScheduleMatchDto[];
  onCardClick?: (m: ScheduleMatchDto) => void;
  onDrop?: (matchId: string, target: DropTarget) => void;
  compact?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const times = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) if (m.scheduledAt) set.add(new Date(m.scheduledAt).toISOString());
    for (const t of extraTimes) set.add(new Date(t).toISOString());
    return [...set].sort();
  }, [matches, extraTimes]);

  const hasUnassigned =
    editable || matches.some((m) => !m.stationId || !stations.some((s) => s.id === m.stationId));
  const columns: { id: string | null; name: string }[] = [
    ...stations.map((s) => ({ id: s.id, name: s.name })),
    ...(hasUnassigned ? [{ id: null, name: 'Unassigned' }] : []),
  ];

  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleMatchDto[]>();
    for (const m of matches) {
      if (!m.scheduledAt) continue;
      const iso = new Date(m.scheduledAt).toISOString();
      const station = m.stationId && stations.some((s) => s.id === m.stationId) ? m.stationId : null;
      const key = cellId(iso, station);
      const list = map.get(key);
      if (list) list.push(m);
      else map.set(key, [m]);
    }
    return map;
  }, [matches, stations]);

  const allMatches = useMemo(
    () => new Map([...matches, ...unscheduled].map((m) => [m.id, m])),
    [matches, unscheduled],
  );
  const active = activeId ? allMatches.get(activeId) : null;

  function handleStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over || !onDrop) return;
    const target = parseCellId(String(e.over.id));
    if (!target) return;
    const m = allMatches.get(String(e.active.id));
    if (!m) return;
    const sameStart =
      (m.scheduledAt ? new Date(m.scheduledAt).toISOString() : null) === target.startAt;
    if (sameStart && (m.stationId ?? null) === target.stationId) return;
    onDrop(m.id, target);
  }

  const gridTemplate = `4.5rem repeat(${columns.length}, minmax(${compact ? 150 : 190}px, 1fr))`;

  const grid = (
    <div className="overflow-x-auto">
      <div className="min-w-full" style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: '0.375rem' }}>
        <div />
        {columns.map((c) => (
          <div
            key={c.id ?? UNASSIGNED}
            className={cn(
              'sticky top-0 rounded-md px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide',
              c.id ? 'bg-[var(--color-surface)] text-[var(--color-ink)]' : 'text-[var(--color-muted)]',
            )}
          >
            {c.name}
          </div>
        ))}
        {times.length === 0 && (
          <div
            className="col-span-full rounded-md border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]"
          >
            No time slots on this day yet.
          </div>
        )}
        {times.map((t) => (
          <RowFragment key={t} t={t} tz={tz}>
            {columns.map((c) => {
              const id = cellId(t, c.id);
              const list = byCell.get(id) ?? [];
              return (
                <DropCell key={id} id={id} editable={editable}>
                  {list.map((m) => (
                    <DraggableCard key={m.id} match={m} editable={editable}>
                      {(handle) => (
                        <MatchCard
                          match={m}
                          tz={tz}
                          conflicts={conflicts}
                          showReferee={showReferee}
                          showTime={false}
                          draggable={editable && m.status !== 'COMPLETED'}
                          dragHandleProps={handle}
                          onClick={onCardClick ? () => onCardClick(m) : undefined}
                        />
                      )}
                    </DraggableCard>
                  ))}
                </DropCell>
              );
            })}
          </RowFragment>
        ))}
      </div>
    </div>
  );

  if (!editable) return grid;

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd} onDragCancel={() => setActiveId(null)}>
      {grid}
      {unscheduled.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Unscheduled ({unscheduled.length}) — drag onto a slot, or drop a scheduled match here to unschedule it
          </p>
          <DropCell id={TRAY} editable className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {unscheduled.map((m) => (
              <DraggableCard key={m.id} match={m} editable>
                {(handle) => (
                  <MatchCard
                    match={m}
                    tz={tz}
                    conflicts={conflicts}
                    showReferee={showReferee}
                    showTime={false}
                    draggable
                    dragHandleProps={handle}
                    onClick={onCardClick ? () => onCardClick(m) : undefined}
                  />
                )}
              </DraggableCard>
            ))}
          </DropCell>
        </div>
      )}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-56 rotate-1 shadow-2xl">
            <MatchCard match={active} tz={tz} showTime={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function RowFragment({ t, tz, children }: { t: string; tz: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-start justify-end pr-1 pt-2 font-mono text-xs text-[var(--color-muted)]">
        {fmtTime(t, tz)}
      </div>
      {children}
    </>
  );
}
