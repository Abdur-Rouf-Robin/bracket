'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { EventForm, type EventFormValues } from '@/components/event/event-form';
import type { EventDetail } from '@/components/event/event-types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function NewEventPage() {
  return (
    <Suspense fallback={null}>
      <NewEventPageInner />
    </Suspense>
  );
}

function NewEventPageInner() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const communityId = searchParams.get('community');

  useEffect(() => {
    if (!loading && !user) {
      const next = communityId
        ? `/events/new?community=${encodeURIComponent(communityId)}`
        : '/events/new';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, communityId]);

  const create = useMutation({
    mutationFn: (values: EventFormValues) =>
      api<EventDetail>('/events', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...values,
          communityId: values.communityId || communityId || null,
        }),
      }),
    onSuccess: (event) => {
      toast.success('Event created');
      void qc.invalidateQueries({ queryKey: ['events-mine'] });
      router.push(`/e/${event.slug}/manage`);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-8 text-[var(--color-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/events" className="text-sm text-[var(--color-muted)] hover:underline">
          ← All events
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Create an event</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Bundle multiple tournaments under one hub — tickets, check-in and a shared stream.
          You can add brackets after this page.
        </p>

        <div className="gaming-card mt-8 rounded-3xl p-6 sm:p-8">
          <EventForm
            initial={communityId ? { communityId } : undefined}
            submitLabel="Create event"
            pending={create.isPending}
            error={error}
            onSubmit={(values) => create.mutate(values)}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Link href="/events">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
