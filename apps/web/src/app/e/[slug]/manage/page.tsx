'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Radio,
  ScanLine,
  Settings,
  Shield,
  SlidersHorizontal,
  Ticket,
  Trophy,
} from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { CheckinPanel } from '@/components/event/checkin-panel';
import { EventForm, type EventFormValues } from '@/components/event/event-form';
import type { EventDetail } from '@/components/event/event-types';
import { ManageOverview } from '@/components/event/manage/manage-overview';
import { ManagePermissions } from '@/components/event/manage/manage-permissions';
import { ManageSettings } from '@/components/event/manage/manage-settings';
import { ManageStream } from '@/components/event/manage/manage-stream';
import { ManageTickets } from '@/components/event/manage/manage-tickets';
import { ManageTournaments } from '@/components/event/manage/manage-tournaments';
import { OrderTable } from '@/components/event/order-table';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'setup', label: 'Setup', icon: SlidersHorizontal },
  { id: 'tournaments', label: 'Tournaments', icon: Trophy },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'checkin', label: 'Check-in', icon: ScanLine },
  { id: 'stream', label: 'Stream', icon: Radio },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTab(v: string | null): v is TabId {
  return !!v && TABS.some((t) => t.id === v);
}

export default function ManageEventPage() {
  return (
    <Suspense fallback={null}>
      <ManageEventPageInner />
    </Suspense>
  );
}

function ManageEventPageInner() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, token, loading } = useAuth();
  const [setupError, setSetupError] = useState('');

  const tabParam = searchParams.get('tab');
  const tab: TabId = isTab(tabParam) ? tabParam : 'overview';

  const setTab = useCallback(
    (next: string) => {
      router.replace(`/e/${slug}/manage${next === 'overview' ? '' : `?tab=${next}`}`);
    },
    [router, slug],
  );

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=/e/${slug}/manage`);
  }, [loading, user, router, slug]);

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', slug, 'auth'],
    enabled: !!token,
    retry: false,
    queryFn: () => api<EventDetail>(`/e/${slug}`, { token }),
  });

  useEffect(() => {
    if (event && !event.canManage) router.replace(`/e/${slug}`);
  }, [event, router, slug]);

  const update = useMutation({
    mutationFn: (values: EventFormValues) =>
      api<EventDetail>(`/events/${event!.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(values),
      }),
    onSuccess: (res) => {
      toast.success('Event updated');
      setSetupError('');
      void qc.invalidateQueries({ queryKey: ['events-mine'] });
      if (res.slug !== slug) {
        router.replace(`/e/${res.slug}/manage?tab=setup`);
      } else {
        void qc.invalidateQueries({ queryKey: ['event', slug] });
      }
    },
    onError: (e: Error) => setSetupError(e.message),
  });

  if (loading || (!!token && isLoading)) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--color-surface)]" />
          <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="panel-card h-96 animate-pulse rounded-2xl" />
            <div className="panel-card h-96 animate-pulse rounded-2xl" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            {error instanceof ApiError && error.status === 404 ? 'Event not found' : 'Could not load event'}
          </h1>
          <Link href="/events" className="mt-6 inline-block">
            <Button variant="secondary">Back to events</Button>
          </Link>
        </main>
      </div>
    );
  }

  if (!event.canManage) return null;

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
              {event.logoUrl ? (
                <img src={event.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-xl font-black text-[var(--color-accent)]">
                  {event.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                Event dashboard
              </p>
              <h1 className="text-2xl font-bold text-[var(--color-ink)]">{event.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-semibold',
                event.isPublished
                  ? 'border-[var(--color-ok)]/40 text-[var(--color-ok)]'
                  : 'border-[#fbbf24]/40 text-[#fbbf24]',
              )}
            >
              {event.isPublished ? 'Published' : 'Draft'}
            </span>
            <Link href={`/e/${event.slug}`} target="_blank">
              <Button variant="secondary" className="gap-2">
                View page <ExternalLink className="size-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="lg:sticky lg:top-24 lg:self-start">
            <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = t.id === tab;
                return (
                  <li key={t.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm transition',
                        active
                          ? 'bg-[color-mix(in_srgb,var(--color-accent)_16%,var(--color-surface))] font-semibold text-[var(--color-ink)]'
                          : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
                      )}
                    >
                      <Icon className={cn('size-4', active && 'text-[var(--color-accent)]')} />
                      {t.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section className="min-w-0">
            <div className="mb-5 flex items-center gap-2">
              <current.icon className="size-5 text-[var(--color-accent)]" />
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">{current.label}</h2>
            </div>

            {tab === 'overview' && <ManageOverview event={event} onNavigate={setTab} />}
            {tab === 'setup' && (
              <div className="gaming-card rounded-3xl p-6 sm:p-8">
                <EventForm
                  key={event.updatedAt ?? event.id}
                  initial={event}
                  submitLabel="Save changes"
                  pending={update.isPending}
                  error={setupError}
                  onSubmit={(values) => update.mutate(values)}
                />
              </div>
            )}
            {tab === 'tournaments' && <ManageTournaments event={event} />}
            {tab === 'tickets' && <ManageTickets event={event} />}
            {tab === 'orders' && <OrderTable eventId={event.id} timezone={event.timezone} />}
            {tab === 'checkin' && <CheckinPanel eventId={event.id} timezone={event.timezone} />}
            {tab === 'stream' && <ManageStream key={event.streamUrl ?? ''} event={event} />}
            {tab === 'permissions' && <ManagePermissions event={event} />}
            {tab === 'settings' && <ManageSettings event={event} />}
          </section>
        </div>
      </main>
    </div>
  );
}
