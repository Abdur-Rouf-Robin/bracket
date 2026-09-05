'use client';

import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import type { SearchResultItem } from '@bracket/shared';

export const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single elimination',
  DOUBLE_ELIMINATION: 'Double elimination',
  ROUND_ROBIN: 'Round robin',
  GROUPS_KNOCKOUT: 'Groups + knockout',
  SWISS: 'Swiss',
  LEAGUE: 'League',
  LADDER: 'Ladder',
  RACE: 'Race',
  EVENT_SERIES: 'Event series',
};

export function formatLabel(format: string | null | undefined) {
  if (!format) return 'Draft';
  return FORMAT_LABELS[format] ?? format.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function statusOf(t: Pick<SearchResultItem, 'status' | 'startAt'>): 'live' | 'upcoming' | 'completed' | 'draft' {
  if (t.status === 'ACTIVE') return 'live';
  if (t.status === 'COMPLETED') return 'completed';
  if (t.startAt && new Date(t.startAt) > new Date()) return 'upcoming';
  return 'draft';
}

export function StatusBadge({ status }: { status: ReturnType<typeof statusOf> }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500">
        <span className="relative inline-flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
        Live
      </span>
    );
  }
  const map = {
    upcoming: 'bg-sky-500/15 text-sky-500',
    completed: 'bg-[var(--color-line)] text-[var(--color-muted)]',
    draft: 'bg-amber-500/15 text-amber-500',
  } as const;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status]}`}>{status}</span>;
}

export function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit' });
}

export function TournamentCard({ t, compact = false }: { t: SearchResultItem; compact?: boolean }) {
  const status = statusOf(t);
  return (
    <Link
      href={`/t/${t.slug}`}
      className="gaming-card group relative flex flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:border-[var(--color-accent)]/40"
    >
      <div className={`relative ${compact ? 'h-20' : 'h-28'} w-full overflow-hidden bg-[var(--color-surface)]`}>
        {t.backgroundImageUrl ? (
          <img src={t.backgroundImageUrl} alt="" className="h-full w-full object-cover opacity-70 transition group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,var(--color-accent)_0%,transparent_70%)] opacity-30" />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <StatusBadge status={status} />
          {t.community && (
            <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">{t.community.name}</span>
          )}
        </div>
        {t.logoUrl && <img src={t.logoUrl} alt="" className="absolute -bottom-5 left-3 h-12 w-12 rounded-xl border-2 border-[var(--color-card)] object-cover" />}
      </div>
      <div className={`flex flex-1 flex-col p-3 ${t.logoUrl ? 'pt-7' : ''}`}>
        <h3 className="font-display line-clamp-2 text-base font-bold leading-tight">{t.name}</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {t.game?.name ? `${t.game.name} · ` : ''}{formatLabel(t.format)}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[11px] text-[var(--color-muted)]">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t._count.teams}</span>
          {t.startAt && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDate(t.startAt)}</span>}
          {t.venueName && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {t.venueName}</span>}
          {t.venueType === 'ONLINE' && <span>Online</span>}
        </div>
      </div>
    </Link>
  );
}

export function CardSkeleton() {
  return <div className="gaming-card h-56 animate-pulse rounded-2xl opacity-50" />;
}
