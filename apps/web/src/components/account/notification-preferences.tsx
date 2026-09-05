'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { InboxPreferences, InboxPreferencesResponse } from '@bracket/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Toggle } from '@/components/registrations/registration-ui';

const CHANNELS: {
  key: keyof InboxPreferences;
  label: string;
  hint: string;
}[] = [
  {
    key: 'inApp',
    label: 'In-app notifications',
    hint: 'Show updates in your inbox and the header bell.',
  },
  {
    key: 'emailRegistration',
    label: 'Email for registration updates',
    hint: 'Approvals, waitlist, and withdrawal messages.',
  },
  {
    key: 'emailMatchComments',
    label: 'Email for match comments',
    hint: 'When someone comments on a match you are in.',
  },
  {
    key: 'emailMatchReady',
    label: 'Email when a match is ready',
    hint: 'Your next match is assigned and ready to play.',
  },
  {
    key: 'emailFinalResults',
    label: 'Email when a tournament finishes',
    hint: 'Final results for events you host or play.',
  },
];

export function NotificationPreferences() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['inbox', 'preferences'],
    enabled: !!token,
    queryFn: () => api<InboxPreferencesResponse>('/inbox/preferences', { token }),
  });

  const save = useMutation({
    mutationFn: (patch: Partial<InboxPreferences>) =>
      api<InboxPreferencesResponse>('/inbox/preferences', {
        method: 'PATCH',
        token,
        body: JSON.stringify(patch),
      }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['inbox', 'preferences'] });
      const previous = qc.getQueryData<InboxPreferencesResponse>(['inbox', 'preferences']);
      if (previous) {
        qc.setQueryData(['inbox', 'preferences'], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (err: Error, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(['inbox', 'preferences'], ctx.previous);
      toast.error(err.message || 'Could not save preferences');
    },
    onSuccess: (data) => {
      qc.setQueryData(['inbox', 'preferences'], data);
      toast.success('Notification preferences saved');
    },
  });

  if (query.isLoading || !query.data) {
    return <p className="text-sm text-[var(--color-muted)]">Loading preferences…</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CHANNELS.map((ch) => (
        <Toggle
          key={ch.key}
          label={ch.label}
          hint={ch.hint}
          checked={query.data[ch.key]}
          disabled={save.isPending}
          onChange={(v) => save.mutate({ [ch.key]: v })}
        />
      ))}
    </div>
  );
}
