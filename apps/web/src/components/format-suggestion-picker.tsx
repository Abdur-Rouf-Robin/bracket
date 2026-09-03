'use client';

import { useQuery } from '@tanstack/react-query';
import type { FormatPlan, GameProfile } from '@bracket/shared';
import { api } from '@/lib/api';

type Props = {
  teamCount: number;
  gameName?: string;
  selectedId?: string;
  onSelect: (plan: FormatPlan) => void;
};

export function FormatSuggestionPicker({
  teamCount,
  gameName,
  selectedId,
  onSelect,
}: Props) {
  const { data: plans = [], isLoading, isError } = useQuery({
    queryKey: ['format-plans', teamCount, gameName],
    enabled: teamCount >= 2,
    queryFn: () =>
      api<FormatPlan[]>(
        `/format-plans?teamCount=${teamCount}${gameName ? `&gameName=${encodeURIComponent(gameName)}` : ''}`,
      ),
  });

  if (teamCount < 2) {
    return (
      <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
        Enter at least 2 teams to see format options.
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-sm text-[var(--color-muted)]">Finding formats for {teamCount} teams…</p>
    );
  }

  if (isError || !plans.length) {
    return (
      <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700">
        No viable format found for {teamCount} teams. Try a different count.
      </p>
    );
  }

  const recommended = plans.filter((p) => p.recommended);
  const others = plans.filter((p) => !p.recommended);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted)]">
        Showing formats that work with <strong>{teamCount} teams</strong>
        {gameName ? ` for ${gameName}` : ''}. Pick one — group sizes and byes are calculated for you.
      </p>

      <div className="space-y-2">
        {recommended.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={selectedId === plan.id}
            onSelect={() => onSelect(plan)}
            badge="Recommended"
          />
        ))}
      </div>

      {others.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            More options ({others.length})
          </summary>
          <div className="mt-2 space-y-2">
            {others.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedId === plan.id}
                onSelect={() => onSelect(plan)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
  badge,
}: {
  plan: FormatPlan;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
          : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/40'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--color-ink)]">{plan.label}</p>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{plan.category}</p>
        </div>
        {badge && (
          <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-accent-deep)]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{plan.detail}</p>
      {plan.byeCount > 0 && (
        <p className="mt-1 text-xs text-amber-800">
          Includes {plan.byeCount} knockout bye{plan.byeCount === 1 ? '' : 's'} to fill the bracket.
        </p>
      )}
    </button>
  );
}

export function GameRulesSummary({ profile }: { profile: GameProfile }) {
  const s = profile.settings;
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
      <p className="font-semibold">{profile.name} rules</p>
      <p className="mt-1 text-[var(--color-muted)]">{profile.blurb}</p>
      <ul className="mt-2 list-inside list-disc text-xs text-[var(--color-muted)]">
        {s.rankBy && <li>Rank by: {String(s.rankBy).replaceAll('_', ' ').toLowerCase()}</li>}
        {s.knockoutBestOf && s.knockoutBestOf > 1 && (
          <li>Knockout best-of {s.knockoutBestOf}</li>
        )}
        {profile.pointsWin != null && (
          <li>
            Points: {profile.pointsWin} win / {profile.pointsDraw ?? 0} draw
          </li>
        )}
        {profile.matchEntry === 'cricket' && <li>Ball-by-ball cricket scoreboard</li>}
        {profile.matchEntry === 'football' && <li>Goals, extra time & penalties</li>}
        {profile.matchEntry === 'coc-war' && <li>Clan war: stars, destruction %, attack window</li>}
        {profile.matchEntry === 'esports-series' && <li>Series / map score entry</li>}
      </ul>
    </div>
  );
}
