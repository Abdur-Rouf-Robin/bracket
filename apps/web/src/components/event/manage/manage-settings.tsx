'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { EventDetail } from '../event-types';

export function ManageSettings({ event }: { event: EventDetail }) {
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const isOwner = user?.id === event.ownerId;

  const unpublish = useMutation({
    mutationFn: () => api(`/events/${event.id}/unpublish`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Event unpublished');
      void qc.invalidateQueries({ queryKey: ['event', event.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleListed = useMutation({
    mutationFn: () =>
      api(`/events/${event.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isPublic: !event.isPublic }),
      }),
    onSuccess: () => {
      toast.success(event.isPublic ? 'Event is now unlisted' : 'Event is now listed');
      void qc.invalidateQueries({ queryKey: ['event', event.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => api(`/events/${event.id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Event deleted');
      void qc.invalidateQueries({ queryKey: ['events-mine'] });
      router.push('/events');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <section className="panel-card rounded-2xl p-5">
        <h3 className="font-semibold text-[var(--color-ink)]">Visibility</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-[var(--color-ink)]">
              {event.isPublic ? 'Listed in the public events directory' : 'Unlisted — reachable via link only'}
            </p>
            <p className="text-xs text-[var(--color-muted)]">Applies only while the event is published.</p>
          </div>
          <Button type="button" variant="secondary" disabled={toggleListed.isPending} onClick={() => toggleListed.mutate()}>
            {event.isPublic ? 'Make unlisted' : 'Make listed'}
          </Button>
        </div>
        {event.isPublished && (
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-line)]/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--color-ink)]">Unpublish event</p>
              <p className="text-xs text-[var(--color-muted)]">
                Hides the page and stops ticket sales. Existing orders are kept.
              </p>
            </div>
            <Button type="button" variant="secondary" disabled={unpublish.isPending} onClick={() => unpublish.mutate()}>
              Unpublish
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-danger)]/40 bg-[color-mix(in_srgb,var(--color-danger)_6%,var(--color-card))] p-5">
        <h3 className="flex items-center gap-2 font-semibold text-[var(--color-danger)]">
          <AlertTriangle className="size-4" /> Danger zone
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Deleting the event removes its tickets, orders and admins. Attached tournaments are
          detached, not deleted. This cannot be undone.
        </p>
        {!isOwner ? (
          <p className="mt-3 text-xs text-[var(--color-muted)]">Only the event owner can delete it.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Type "${event.slug}" to confirm`}
              className="sm:max-w-xs"
            />
            <Button
              type="button"
              variant="secondary"
              className="border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)]"
              disabled={confirmText !== event.slug || remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? 'Deleting…' : 'Delete event'}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
