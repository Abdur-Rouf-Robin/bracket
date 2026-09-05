'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarRange, LayoutTemplate, Plus, Users2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { AppNotification, Community, PlatformEvent, TournamentTemplate } from '@/lib/types-platform';
import type { ReactNode } from 'react';

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-4" aria-label={title}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display inline-flex items-center gap-2 text-sm font-bold">
          <Icon className="size-4 text-[var(--color-muted)]" /> {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

function PanelEmpty({ text, cta }: { text: string; cta?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-line)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
      <p>{text}</p>
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}

function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object' && Array.isArray((res as { items?: unknown }).items)) {
    return (res as { items: T[] }).items;
  }
  return [];
}

export function CommunitiesPanel({ token }: { token: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['communities', 'mine'],
    enabled: !!token,
    retry: false,
    queryFn: async () => unwrapList<Community>(await api<unknown>('/communities/mine', { token })),
  });
  return (
    <Panel
      title="Your communities"
      icon={Users2}
      action={
        <Button size="sm" variant="ghost" asChild>
          <Link href="/communities/new"><Plus /> New</Link>
        </Button>
      }
    >
      {isLoading ? (
        <PanelSkeleton />
      ) : isError || !data || data.length === 0 ? (
        <PanelEmpty
          text="Communities group your tournaments, members and Elo rankings."
          cta={
            <Button size="sm" variant="outline" asChild>
              <Link href="/communities">Browse communities</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {data.slice(0, 5).map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className="flex items-center gap-3 py-2 hover:text-[var(--color-accent)]">
                <Avatar name={c.name} src={c.logoUrl} size="sm" square />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-[var(--color-muted)]">
                    {c._count?.tournaments ?? 0} tournaments · {c._count?.members ?? 0} members
                  </span>
                </span>
                {c.viewerRole && <Badge variant="neutral" className="capitalize">{c.viewerRole.toLowerCase()}</Badge>}
                {c.isPro && <Badge variant="premier">Pro</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function EventsPanel({ token }: { token: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', 'mine'],
    enabled: !!token,
    retry: false,
    queryFn: async () => unwrapList<PlatformEvent>(await api<unknown>('/events/mine', { token })),
  });
  return (
    <Panel
      title="Your events"
      icon={CalendarRange}
      action={
        <Button size="sm" variant="ghost" asChild>
          <Link href="/events/new"><Plus /> New</Link>
        </Button>
      }
    >
      {isLoading ? (
        <PanelSkeleton />
      ) : isError || !data || data.length === 0 ? (
        <PanelEmpty text="Events bundle several tournaments with tickets, a venue and a schedule." />
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {data.slice(0, 5).map((e) => (
            <li key={e.id}>
              <Link href={`/e/${e.slug}`} className="flex items-center gap-3 py-2 hover:text-[var(--color-accent)]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.name}</span>
                  <span className="block text-xs text-[var(--color-muted)]">
                    {e.startAt ? new Date(e.startAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Date TBA'}
                    {e.venueName ? ` · ${e.venueName}` : ''}
                  </span>
                </span>
                <Badge variant={e.isPublished ? 'ok' : 'warning'}>{e.isPublished ? 'Published' : 'Draft'}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function TemplatesPanel({ token }: { token: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['templates'],
    enabled: !!token,
    retry: false,
    queryFn: async () => unwrapList<TournamentTemplate>(await api<unknown>('/templates', { token })),
  });
  return (
    <Panel title="Templates" icon={LayoutTemplate}>
      {isLoading ? (
        <PanelSkeleton rows={2} />
      ) : isError || !data || data.length === 0 ? (
        <PanelEmpty text="Save a tournament as a template from its settings to reuse it in one click." />
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {data.slice(0, 5).map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.name}</span>
                {t.description && <span className="block truncate text-xs text-[var(--color-muted)]">{t.description}</span>}
              </span>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/tournaments/new?template=${encodeURIComponent(t.id)}`}>Use</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function ActivityPanel({ token }: { token: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['inbox', 'recent'],
    enabled: !!token,
    retry: false,
    queryFn: async () => unwrapList<AppNotification>(await api<unknown>('/inbox?limit=5', { token })),
  });
  return (
    <Panel
      title="Recent activity"
      icon={Bell}
      action={
        <Button size="sm" variant="ghost" asChild>
          <Link href="/inbox">View all</Link>
        </Button>
      }
    >
      {isLoading ? (
        <PanelSkeleton />
      ) : isError || !data || data.length === 0 ? (
        <PanelEmpty text="Registrations, results and mentions will show up here." />
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {data.slice(0, 5).map((n) => {
            const body = (
              <>
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.readAt ? 'bg-[var(--color-line)]' : 'bg-[var(--color-accent)]'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{n.title}</span>
                  {n.body && <span className="block truncate text-xs text-[var(--color-muted)]">{n.body}</span>}
                </span>
                <time className="shrink-0 text-[11px] text-[var(--color-muted)]" dateTime={n.createdAt}>
                  {relTime(n.createdAt)}
                </time>
              </>
            );
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} className="flex items-start gap-2 py-2 hover:text-[var(--color-accent)]">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-2 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
