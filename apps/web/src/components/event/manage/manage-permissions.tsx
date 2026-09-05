'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Crown, Shield, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { EventAdminsResponse, EventDetail } from '../event-types';

export function ManagePermissions({ event }: { event: EventDetail }) {
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['event-admins', event.id],
    enabled: !!token,
    queryFn: () => api<EventAdminsResponse>(`/events/${event.id}/admins`, { token }),
  });

  const add = useMutation({
    mutationFn: () =>
      api(`/events/${event.id}/admins`, {
        method: 'POST',
        token,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }),
    onSuccess: () => {
      toast.success('Admin added');
      setEmail('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['event-admins', event.id] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (adminId: string) =>
      api(`/events/${event.id}/admins/${adminId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Admin removed');
      void qc.invalidateQueries({ queryKey: ['event-admins', event.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <form
        className="panel-card space-y-3 rounded-2xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          add.mutate();
        }}
      >
        <h3 className="flex items-center gap-2 font-semibold text-[var(--color-ink)]">
          <UserPlus className="size-4 text-[var(--color-accent)]" /> Add an admin
        </h3>
        <p className="text-xs text-[var(--color-muted)]">
          Admins can edit the event, manage tickets, orders, check-in and tournaments. They must
          already have an account.
        </p>
        <div>
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
          />
        </div>
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={add.isPending || !email.trim()}>
            {add.isPending ? 'Adding…' : 'Add admin'}
          </Button>
        </div>
      </form>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">People with access</p>
        {isLoading ? (
          <div className="panel-card h-24 animate-pulse rounded-2xl" />
        ) : (
          <ul className="panel-card divide-y divide-[var(--color-line)]/60 rounded-2xl">
            {data?.owner && (
              <li className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <Crown className="size-4 text-[#fbbf24]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      {data.owner.name}
                      {data.owner.id === user?.id && <span className="ml-2 text-xs text-[var(--color-muted)]">(you)</span>}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">{data.owner.email}</p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Owner</span>
              </li>
            )}
            {data?.admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <Shield className="size-4 text-[var(--color-accent)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      {a.user.name}
                      {a.user.id === user?.id && <span className="ml-2 text-xs text-[var(--color-muted)]">(you)</span>}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">{a.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{a.role}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-[var(--color-danger)]"
                    disabled={remove.isPending}
                    aria-label="Remove admin"
                    onClick={() => {
                      if (confirm(`Remove ${a.user.name} as admin?`)) remove.mutate(a.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
            {data && data.admins.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-[var(--color-muted)]">
                No additional admins yet.
              </li>
            )}
          </ul>
        )}
        {event.community && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Collaborators and above in <span className="text-[var(--color-ink)]">{event.community.name}</span> can also
            manage this event.
          </p>
        )}
      </section>
    </div>
  );
}
