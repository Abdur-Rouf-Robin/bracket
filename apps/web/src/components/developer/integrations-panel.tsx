'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Code2, KeyRound, Plus, Send, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, type WebhookEvent } from '@bracket/shared';
import { api, API_URL } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import type { Webhook } from '@/lib/types-platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyField, Section, webOrigin } from '@/components/sharing/panel-kit';

/**
 * Integrations for one tournament: scoped webhooks, public API pointers,
 * embed snippet and calendar (ICS) feed.
 */
export function IntegrationsPanel({
  tournament,
  token,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  sub: string;
}) {
  const origin = webOrigin();
  return (
    <div className="space-y-6">
      <WebhooksSection tournament={tournament} token={token} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Public API" description="Read and update this tournament programmatically with an API key.">
          <div className="space-y-2 text-xs">
            <p className="text-[var(--color-muted)]">Tournament ID</p>
            <CopyField value={tournament.id} />
            <p className="text-[var(--color-muted)]">Example</p>
            <pre className="overflow-x-auto rounded-lg bg-[#0a0c10] p-3 font-mono text-[11px] text-white/90">{`curl ${API_URL}/v1/tournaments/${tournament.slug}?include=participants,matches \\\n  -H "X-Api-Key: brk_live_…"`}</pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/developer" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-[#041018]">
              <KeyRound className="h-3.5 w-3.5" /> Manage API keys
            </Link>
            <Link href="/api-docs" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">
              <Code2 className="h-3.5 w-3.5" /> API docs
            </Link>
          </div>
        </Section>
        <Section title="Calendar feed (ICS)" description="Subscribe in Google Calendar, Apple Calendar or Outlook to get every scheduled match.">
          <CopyField value={`${API_URL}/t/${tournament.slug}/schedule.ics`} />
          <a href={`${API_URL}/t/${tournament.slug}/schedule.ics`} className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline">
            <Calendar className="h-3.5 w-3.5" /> Download .ics
          </a>
        </Section>
      </div>
      <Section title="Embed snippet" description="Quick copy — use Settings → Sharing for the full builder with preview.">
        <CopyField value={`<iframe src="${origin}/embed/${tournament.slug}?showTabs=1" width="100%" height="600" style="border:0;border-radius:12px" loading="lazy"></iframe>`} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function WebhooksSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const qc = useQueryClient();
  const key = ['webhooks', { tournamentId: tournament.id }];
  const list = useQuery({
    queryKey: key,
    enabled: !!token,
    queryFn: () => api<Webhook[]>(`/developer/webhooks?tournamentId=${tournament.id}`, { token }),
  });
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['match.completed', 'tournament.completed']);
  const [secret, setSecret] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      api<Webhook & { secret: string }>('/developer/webhooks', {
        method: 'POST',
        token,
        body: JSON.stringify({ url: url.trim(), events, tournamentId: tournament.id }),
      }),
    onSuccess: async (w) => {
      setSecret(w.secret);
      setUrl('');
      toast.success('Webhook created — copy the signing secret now');
      await qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (w: Webhook) => api(`/developer/webhooks/${w.id}`, { method: 'PATCH', token, body: JSON.stringify({ isActive: !w.isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/developer/webhooks/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; status: number | null; durationMs: number; error: string | null }>(`/developer/webhooks/${id}/test`, { method: 'POST', token }),
    onSuccess: (r, id) => {
      setTestResult((p) => ({ ...p, [id]: r.ok ? `OK · ${r.status} in ${r.durationMs}ms` : `Failed · ${r.error ?? r.status}` }));
      if (r.ok) toast.success('Test delivery succeeded');
      else toast.error(`Test failed: ${r.error ?? r.status}`);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      title="Webhooks"
      description="Get an HTTPS POST when things happen in this tournament. Payloads are signed with HMAC-SHA256 (X-Bracket-Signature)."
    >
      <div className="grid gap-3 rounded-lg border border-[var(--color-line)] p-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div>
            <Label>Endpoint URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hooks/bracket" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WEBHOOK_EVENTS.map((ev) => {
              const on = events.includes(ev);
              return (
                <button
                  key={ev}
                  type="button"
                  title={WEBHOOK_EVENT_LABELS[ev]}
                  onClick={() => setEvents(on ? events.filter((e) => e !== ev) : [...events, ev])}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${on ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]' : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}
                >
                  {ev}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-end">
          <Button type="button" disabled={!/^https:\/\//i.test(url.trim()) && !/^http:\/\/localhost/i.test(url.trim()) || !events.length || create.isPending} onClick={() => create.mutate()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add webhook
          </Button>
        </div>
      </div>
      {secret && (
        <div className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
          <p className="font-semibold text-emerald-700">Signing secret (shown once)</p>
          <CopyField value={secret} />
          <p className="text-[var(--color-muted)]">Verify: <code>sha256=HMAC_SHA256(secret, rawBody)</code> equals <code>X-Bracket-Signature</code>. <Link className="text-[var(--color-accent)] hover:underline" href="/api-docs#webhooks">See docs</Link>.</p>
          <Button type="button" variant="ghost" onClick={() => setSecret(null)}>Dismiss</Button>
        </div>
      )}
      {list.isLoading && <p className="text-xs text-[var(--color-muted)]">Loading webhooks…</p>}
      {list.isError && <p className="text-xs text-red-500">{(list.error as Error).message}</p>}
      {list.data && list.data.length === 0 && <p className="text-xs text-[var(--color-muted)]">No webhooks for this tournament yet.</p>}
      <ul className="space-y-2">
        {(list.data ?? []).map((w) => (
          <li key={w.id} className="rounded-lg border border-[var(--color-line)] p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <WebhookIcon className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
                <span className="truncate font-mono">{w.url}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${w.isActive ? 'bg-emerald-500/15 text-emerald-600' : 'bg-[var(--color-line)] text-[var(--color-muted)]'}`}>
                  {w.isActive ? 'active' : 'paused'}
                </span>
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" className="px-2 py-1" onClick={() => test.mutate(w.id)} disabled={test.isPending} title="Send test">
                  <Send className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" className="px-2 py-1" onClick={() => toggle.mutate(w)}>
                  {w.isActive ? 'Pause' : 'Resume'}
                </Button>
                <Button type="button" variant="ghost" className="px-2 py-1 text-red-500" onClick={() => { if (window.confirm('Delete this webhook?')) remove.mutate(w.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {w.events.map((ev) => (
                <span key={ev} className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[10px]">{ev}</span>
              ))}
            </div>
            <p className="mt-1.5 text-[var(--color-muted)]">
              Last delivery: {w.lastSentAt ? `${new Date(w.lastSentAt).toLocaleString()} · HTTP ${w.lastStatus ?? '—'}` : 'never'}
              {w.failureCount > 0 && <span className="ml-2 text-amber-600">{w.failureCount} consecutive failure(s)</span>}
              {testResult[w.id] && <span className="ml-2 text-[var(--color-ink)]">Test: {testResult[w.id]}</span>}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
