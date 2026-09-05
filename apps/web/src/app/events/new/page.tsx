'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { EventForm, type EventFormValues } from '@/components/event/event-form';
import type { EventDetail } from '@/components/event/event-types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function NewEventPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const create = useMutation({
    mutationFn: (values: EventFormValues) =>
      api<EventDetail>('/events', {
        method: 'POST',
        token,
        body: JSON.stringify(values),
      }),
    onSuccess: (event) => {
      toast.success('Event created — it stays a draft until you publish it');
      router.push(`/e/${event.slug}/manage`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft className="size-4" /> All events
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-[var(--color-ink)]">Create an event</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          An event groups several tournaments under one banner with tickets, a stream and
          check-in. You can add tournaments and tickets after creating it.
        </p>

        <div className="gaming-card mt-8 rounded-3xl p-6 sm:p-8">
          {loading || !user ? (
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          ) : (
            <EventForm
              submitLabel="Create event"
              pending={create.isPending}
              error={error}
              onSubmit={(values) => {
                setError('');
                create.mutate(values);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
