'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Send, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { WEBHOOK_EVENT_LABELS, WEBHOOK_EVENTS, type WebhookEvent } from '@bracket/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Webhook } from '@/lib/types-platform';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SecretReveal } from './secret-reveal';

const HOOKS_QUERY = ['developer', 'webhooks'] as const;

function formatWhen(iso?: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function isAllowedWebhookUrl(url: string) {
  return /^https:\/\//i.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)/i.test(url);
}

export function WebhooksSection() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['match.completed', 'tournament.completed']);
  const [tournamentId, setTournamentId] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const list = useQuery({
    queryKey: HOOKS_QUERY,
    enabled: !!token,
    queryFn: () => api<Webhook[]>('/developer/webhooks', { token }),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Webhook & { secret: string }>('/developer/webhooks', {
        method: 'POST',
        token,
        body: JSON.stringify({
          url: url.trim(),
          events,
          tournamentId: tournamentId.trim() || undefined,
        }),
      }),
    onSuccess: async (row) => {
      setCreatedSecret(row.secret);
      toast.success('Webhook created — copy the signing secret now');
      await qc.invalidateQueries({ queryKey: HOOKS_QUERY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (w: Webhook) =>
      api(`/developer/webhooks/${w.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: !w.isActive }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: HOOKS_QUERY }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/developer/webhooks/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Webhook deleted');
      void qc.invalidateQueries({ queryKey: HOOKS_QUERY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean; status: number | null; durationMs: number; error: string | null }>(
        `/developer/webhooks/${id}/test`,
        { method: 'POST', token },
      ),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Test delivery succeeded · ${r.status} in ${r.durationMs}ms`);
      else toast.error(`Test failed: ${r.error ?? r.status}`);
      void qc.invalidateQueries({ queryKey: HOOKS_QUERY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetDialog() {
    setUrl('');
    setEvents(['match.completed', 'tournament.completed']);
    setTournamentId('');
    setCreatedSecret(null);
    create.reset();
  }

  function toggleEvent(ev: WebhookEvent) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

  const columns = useMemo<Column<Webhook>[]>(
    () => [
      {
        id: 'url',
        header: 'URL',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-xs" title={row.url}>
              {row.url}
            </p>
            {row.tournamentId && (
              <p className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]">
                Tournament {row.tournamentId}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'events',
        header: 'Events',
        hideBelow: 'md',
        cell: (row) => (
          <div className="flex max-w-xs flex-wrap gap-1">
            {row.events.map((ev) => (
              <span key={ev} className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[10px]">
                {ev}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Last status',
        hideBelow: 'lg',
        cell: (row) => (
          <div className="text-xs">
            <p className="text-[var(--color-muted)]">
              {row.lastStatus != null ? `HTTP ${row.lastStatus}` : '—'}
            </p>
            {row.failureCount > 0 && (
              <p className="text-amber-600">
                {row.failureCount} consecutive failure{row.failureCount === 1 ? '' : 's'}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'sent',
        header: 'Last sent',
        hideBelow: 'lg',
        cell: (row) => <span className="text-xs text-[var(--color-muted)]">{formatWhen(row.lastSentAt)}</span>,
      },
      {
        id: 'active',
        header: 'Active',
        cell: (row) => (
          <Switch
            checked={row.isActive}
            disabled={toggle.isPending}
            onCheckedChange={() => toggle.mutate(row)}
            aria-label={row.isActive ? 'Pause webhook' : 'Resume webhook'}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        align: 'right',
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Send test delivery"
              disabled={test.isPending}
              onClick={() => test.mutate(row.id)}
            >
              <Send />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-[var(--color-danger)]"
              title="Delete webhook"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm('Delete this webhook?')) remove.mutate(row.id);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [remove.isPending, remove.mutate, test.isPending, test.mutate, toggle.isPending, toggle.mutate],
  );

  const canSubmit = isAllowedWebhookUrl(url.trim()) && events.length > 0 && !create.isPending;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Webhooks</h2>
          <p className="mt-1 max-w-xl text-xs text-[var(--color-muted)]">
            HTTPS POST when something happens. Bodies are signed with HMAC-SHA256 (
            <code className="font-mono">X-Bracket-Signature</code>). Account-level hooks fire for every tournament you
            manage; optionally scope one to a single tournament ID.
          </p>
        </div>
        <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add webhook
        </Button>
      </div>

      {list.isError && <p className="text-sm text-[var(--color-danger)]">{(list.error as Error).message}</p>}

      <DataTable
        columns={columns}
        rows={list.data ?? []}
        rowKey={(row) => row.id}
        loading={list.isLoading}
        dense
        emptyMessage={
          <span className="inline-flex items-center gap-2">
            <WebhookIcon className="h-4 w-4" />
            No webhooks yet. Add an HTTPS endpoint to receive events.
          </span>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetDialog();
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{createdSecret ? 'Copy the signing secret' : 'Add webhook'}</DialogTitle>
            <DialogDescription>
              {createdSecret
                ? 'Verify deliveries with this secret. It is not stored in the dashboard after you close this dialog.'
                : 'We POST JSON to your URL and sign the raw body. Use https:// (or http://localhost for local tests).'}
            </DialogDescription>
          </DialogHeader>

          {createdSecret ? (
            <SecretReveal
              title="Signing secret (shown once)"
              value={createdSecret}
              hint={
                <p>
                  Compare <code className="font-mono">sha256=HMAC_SHA256(secret, rawBody)</code> to{' '}
                  <code className="font-mono">X-Bracket-Signature</code>.
                </p>
              }
              onDismiss={() => {
                setOpen(false);
                resetDialog();
              }}
            />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                create.mutate();
              }}
            >
              <div>
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/hooks/bracket"
                  required
                />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-[var(--color-muted)]">Events</legend>
                <div className="flex flex-wrap gap-1.5">
                  {WEBHOOK_EVENTS.map((ev) => {
                    const on = events.includes(ev);
                    return (
                      <button
                        key={ev}
                        type="button"
                        title={WEBHOOK_EVENT_LABELS[ev]}
                        onClick={() => toggleEvent(ev)}
                        className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${
                          on
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                            : 'border-[var(--color-line)] text-[var(--color-muted)]'
                        }`}
                      >
                        {ev}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div>
                <Label htmlFor="webhook-tournament">Tournament ID (optional)</Label>
                <Input
                  id="webhook-tournament"
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                  placeholder="Leave blank for every tournament you manage"
                />
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  Copy the ID from a tournament’s Integrations tab to scope this hook.
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={create.isPending} disabled={!canSubmit}>
                  Create webhook
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
