'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FORMAT_META, type TournamentFormat } from '@bracket/shared';
import {
  CalendarDays,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Printer,
  QrCode,
  Search,
  Settings2,
  Share2,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, tournamentStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import type { Tournament } from '@/lib/types';

export type TournamentFilter = 'ALL' | 'DRAFT' | 'ACTIVE' | 'COMPLETED';

export function bucketOf(t: Tournament): Exclude<TournamentFilter, 'ALL'> {
  if (t.status === 'COMPLETED') return 'COMPLETED';
  if (t.status === 'ACTIVE' || (t._count?.matches ?? t.matches?.length ?? 0) > 0) return 'ACTIVE';
  return 'DRAFT';
}

export function formatLabel(format: string | null | undefined): string | null {
  if (!format) return null;
  return FORMAT_META[format as TournamentFormat]?.label ?? format.replaceAll('_', ' ').toLowerCase();
}

function formatDate(iso?: string | null, tz?: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz || undefined,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function publicUrl(slug: string): string {
  if (typeof window === 'undefined') return `/t/${slug}`;
  return `${window.location.origin}/t/${slug}`;
}

async function copy(text: string, label = 'Link copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Could not copy to clipboard');
  }
}

export function TournamentCard({
  t,
  onDelete,
}: {
  t: Tournament;
  onDelete: (t: Tournament) => void;
}) {
  const registrationOpen = Boolean((t.settings as Record<string, unknown> | undefined)?.registrationOpen);
  const status = tournamentStatusBadge({
    status: t.status,
    registrationOpen,
    hasMatches: (t._count?.matches ?? 0) > 0,
  });
  const teams = t._count?.teams ?? t.teams?.length ?? 0;
  const fmt = formatLabel(t.format);
  const when = formatDate(t.startAt, t.timezone);

  return (
    <div className="card card-hover group flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <Link
        href={`/t/${t.slug}/manage`}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface)] ring-1 ring-[var(--color-line)]">
          {t.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <Trophy className="size-4 text-[var(--color-muted)]" aria-hidden />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold group-hover:text-[var(--color-accent)]">{t.name}</span>
            <Badge variant={status.variant} live={status.live}>
              {status.label}
            </Badge>
            {t.isPublic === false && <Badge variant="neutral">Private</Badge>}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
            {fmt && <span className="capitalize">{fmt}</span>}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> {teams} {teams === 1 ? 'participant' : 'participants'}
            </span>
            {when && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden /> {when}
              </span>
            )}
            {t.game?.name && <span>{t.game.name}</span>}
            {t.community?.name && <span>· {t.community.name}</span>}
          </span>
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
        <Button size="sm" asChild>
          <Link href={`/t/${t.slug}/manage`}>
            <Settings2 /> Manage
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild className="hidden sm:inline-flex">
          <Link href={`/t/${t.slug}`}>
            <ExternalLink /> Public page
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Share ${t.name}`}>
              <Share2 />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Share</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => copy(publicUrl(t.slug))}>
              <Copy /> Copy public link
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/t/${t.slug}/qr`}>
                <QrCode /> QR code
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/t/${t.slug}/print`}>
                <Printer /> Print bracket
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${t.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild className="sm:hidden">
              <Link href={`/t/${t.slug}`}>
                <ExternalLink /> Public page
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => copy(`/t/${t.slug}`.replace(/^\//, `${window.location.origin}/`), 'Slug link copied')}>
              <Copy /> Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[var(--color-danger)] focus:text-[var(--color-danger)]"
              onSelect={() => onDelete(t)}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function TournamentList({
  tournaments,
  loading,
  onDelete,
  deleting,
}: {
  tournaments: Tournament[] | undefined;
  loading: boolean;
  onDelete: (id: string) => Promise<unknown> | void;
  deleting?: boolean;
}) {
  const [filter, setFilter] = useState<TournamentFilter>('ALL');
  const [q, setQ] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Tournament | null>(null);

  const counts = useMemo(() => {
    const c = { ALL: 0, DRAFT: 0, ACTIVE: 0, COMPLETED: 0 };
    for (const t of tournaments ?? []) {
      c.ALL++;
      c[bucketOf(t)]++;
    }
    return c;
  }, [tournaments]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (tournaments ?? []).filter((t) => {
      if (filter !== 'ALL' && bucketOf(t) !== filter) return false;
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        t.slug.toLowerCase().includes(needle) ||
        (t.game?.name ?? '').toLowerCase().includes(needle) ||
        (formatLabel(t.format) ?? '').toLowerCase().includes(needle)
      );
    });
  }, [tournaments, filter, q]);

  return (
    <section aria-labelledby="my-tournaments-heading" className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 id="my-tournaments-heading" className="font-display text-xl font-bold">
          Your tournaments
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SegmentedControl<TournamentFilter>
            size="sm"
            aria-label="Filter tournaments"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'All', count: counts.ALL },
              { value: 'DRAFT', label: 'Draft', count: counts.DRAFT },
              { value: 'ACTIVE', label: 'Live', count: counts.ACTIVE },
              { value: 'COMPLETED', label: 'Completed', count: counts.COMPLETED },
            ]}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your tournaments"
              aria-label="Search your tournaments"
              className="h-9 w-full pl-8 sm:w-56"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        counts.ALL === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No tournaments yet"
            description="Create your first tournament in under a minute — paste names, pick a format and you're live."
            action={
              <>
                <Button asChild>
                  <Link href="/tournaments/new">Create a tournament</Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href="/bracket-generator">Try the quick generator</Link>
                </Button>
              </>
            }
          />
        ) : (
          <EmptyState
            compact
            icon={Search}
            title="Nothing matches"
            description="Try a different filter or search term."
            action={
              <Button variant="ghost" size="sm" onClick={() => { setFilter('ALL'); setQ(''); }}>
                Clear filters
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <TournamentCard key={t.id} t={t} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete “{pendingDelete?.name}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the tournament, its participants, matches and results. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={async () => {
                if (!pendingDelete) return;
                await onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              <Trash2 /> Delete tournament
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
