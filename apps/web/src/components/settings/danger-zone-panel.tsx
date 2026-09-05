'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Copy, Link2, RotateCcw, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import type { Community, PlatformEvent, Ranking } from '@/lib/types-platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Section, useSaveTournament, webOrigin } from '@/components/sharing/panel-kit';

type MineTournament = Pick<Tournament, 'id' | 'name' | 'slug' | 'status'> & { _count?: { teams: number } };

/**
 * Advanced tools: rename, change URL, clone, copy participants, reopen,
 * move to community/event, link to ranking, delete.
 */
export function DangerZonePanel({
  tournament,
  token,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  sub: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <RenameSection tournament={tournament} token={token} />
        <ChangeUrlSection tournament={tournament} token={token} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CloneSection tournament={tournament} token={token} />
        <CopyParticipantsSection tournament={tournament} token={token} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CommunityEventSection tournament={tournament} token={token} />
        <RankingSection tournament={tournament} token={token} />
      </div>
      <ReopenSection tournament={tournament} token={token} />
      <DeleteSection tournament={tournament} token={token} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function RenameSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const save = useSaveTournament(tournament, token);
  const [name, setName] = useState(tournament.name);
  return (
    <Section title="Rename tournament">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={!name.trim() || name.trim() === tournament.name || save.isPending}
        onClick={() => save.mutate({ name: name.trim() }, { onSuccess: () => toast.success('Renamed') })}
      >
        Save name
      </Button>
    </Section>
  );
}

function ChangeUrlSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const router = useRouter();
  const save = useSaveTournament(tournament, token);
  const [slug, setSlug] = useState(tournament.slug);
  const cleaned = slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const valid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned) && cleaned.length >= 2;
  return (
    <Section title="Change URL" description="Old links, embeds and printed QR codes will stop working.">
      <div>
        <Label>Slug</Label>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-[var(--color-muted)]">{webOrigin()}/t/</span>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" />
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={!valid || cleaned === tournament.slug || save.isPending}
        onClick={() => {
          if (!window.confirm(`Change URL to /t/${cleaned}? Old links will break.`)) return;
          save.mutate(
            { slug: cleaned },
            {
              onSuccess: (t) => {
                toast.success(`URL is now /t/${t.slug}`);
                router.replace(`/t/${t.slug}/manage?tab=settings&sub=danger`);
              },
            },
          );
        }}
      >
        Change URL
      </Button>
      <p className="text-[11px] text-[var(--color-muted)]">Availability check and more branding options live under Settings → Branding.</p>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function CloneSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const router = useRouter();
  const [name, setName] = useState(`${tournament.name} (copy)`);
  const [includeParticipants, setIncludeParticipants] = useState(true);
  const clone = useMutation({
    mutationFn: () =>
      api<Tournament>(`/tournaments/${tournament.id}/clone`, {
        method: 'POST',
        token,
        body: JSON.stringify({ name: name.trim() || undefined, includeParticipants }),
      }),
    onSuccess: (t) => {
      toast.success(`Created "${t.name}" as a draft`);
      router.push(`/t/${t.slug}/manage`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Section
      title="Clone tournament"
      description="Creates a new DRAFT with the same format, settings, branding and (optionally) participants. Results are not copied."
    >
      <div>
        <Label>New name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeParticipants} onChange={(e) => setIncludeParticipants(e.target.checked)} />
        Include participants ({tournament.teams.length}) and rosters
      </label>
      <Button type="button" disabled={clone.isPending} onClick={() => clone.mutate()} className="gap-1.5">
        <Copy className="h-4 w-4" /> {clone.isPending ? 'Cloning…' : 'Clone'}
      </Button>
    </Section>
  );
}

function CopyParticipantsSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const qc = useQueryClient();
  const [sourceId, setSourceId] = useState('');
  const [mode, setMode] = useState<'replace' | 'append'>('append');
  const locked = (tournament.matches?.length ?? 0) > 0;
  const mine = useQuery({
    queryKey: ['tournaments-mine'],
    enabled: !!token,
    queryFn: () => api<MineTournament[]>('/tournaments/mine', { token }),
  });
  const options = useMemo(() => (mine.data ?? []).filter((t) => t.id !== tournament.id), [mine.data, tournament.id]);
  const copy = useMutation({
    mutationFn: () =>
      api<{ created: number; skipped: number }>(`/tournaments/${tournament.id}/teams/copy-from/${sourceId}`, {
        method: 'POST',
        token,
        body: JSON.stringify({ mode }),
      }),
    onSuccess: async (r) => {
      toast.success(`Copied ${r.created} participant(s)${r.skipped ? `, skipped ${r.skipped} duplicate(s)` : ''}`);
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Section title="Copy participants from another tournament" description="Only possible before the bracket is generated. Source must be yours or public.">
      {locked && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Bracket already generated — reset it first.
        </p>
      )}
      <div>
        <Label>Source tournament</Label>
        <select className="field-select w-full" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Select one of your tournaments…</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t._count?.teams ?? 0} participants)
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">Or paste a tournament ID below.</p>
        <Input className="mt-1 font-mono text-xs" placeholder="Tournament ID" value={sourceId} onChange={(e) => setSourceId(e.target.value.trim())} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <select className="field-select" value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'append')}>
          <option value="append">Append (skip duplicates)</option>
          <option value="replace">Replace current participants</option>
        </select>
        <Button type="button" variant="secondary" disabled={!sourceId || locked || copy.isPending} onClick={() => copy.mutate()} className="gap-1.5">
          <Users className="h-4 w-4" /> Copy participants
        </Button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function CommunityEventSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const qc = useQueryClient();
  const communities = useQuery({
    queryKey: ['communities-mine'],
    enabled: !!token,
    queryFn: async () => {
      try {
        const res = await api<Community[] | { items?: Community[] }>('/communities/mine', { token });
        return Array.isArray(res) ? res : (res.items ?? []);
      } catch {
        return [] as Community[];
      }
    },
  });
  const events = useQuery({
    queryKey: ['events-mine'],
    enabled: !!token,
    queryFn: async () => {
      try {
        const res = await api<PlatformEvent[] | { items?: PlatformEvent[] }>('/events/mine', { token });
        return Array.isArray(res) ? res : (res.items ?? []);
      } catch {
        return [] as PlatformEvent[];
      }
    },
  });
  const [communityId, setCommunityId] = useState(tournament.communityId ?? '');
  const [eventId, setEventId] = useState(tournament.eventId ?? '');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });

  const moveCommunity = useMutation({
    mutationFn: async () => {
      if (tournament.communityId && tournament.communityId !== communityId) {
        await api(`/communities/${tournament.communityId}/tournaments/${tournament.id}`, { method: 'DELETE', token }).catch(() => undefined);
      }
      if (communityId) {
        await api(`/communities/${communityId}/tournaments/${tournament.id}`, { method: 'POST', token, body: JSON.stringify({}) });
      }
    },
    onSuccess: async () => {
      toast.success(communityId ? 'Moved to community' : 'Removed from community');
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const moveEvent = useMutation({
    mutationFn: async () => {
      if (tournament.eventId && tournament.eventId !== eventId) {
        await api(`/events/${tournament.eventId}/tournaments/${tournament.id}`, { method: 'DELETE', token }).catch(() => undefined);
      }
      if (eventId) {
        await api(`/events/${eventId}/tournaments/${tournament.id}`, { method: 'POST', token, body: JSON.stringify({}) });
      }
    },
    onSuccess: async () => {
      toast.success(eventId ? 'Attached to event' : 'Detached from event');
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section title="Community & event" description="Host this tournament under a community hub or attach it to a multi-tournament event.">
      <div>
        <Label>Community</Label>
        <div className="flex gap-2">
          <select className="field-select w-full" value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
            <option value="">— none —</option>
            {(communities.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button type="button" variant="secondary" disabled={moveCommunity.isPending || communityId === (tournament.communityId ?? '')} onClick={() => moveCommunity.mutate()}>
            Apply
          </Button>
        </div>
        {tournament.community && (
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            Currently in <Link className="text-[var(--color-accent)] hover:underline" href={`/c/${tournament.community.slug}`}>{tournament.community.name}</Link>
          </p>
        )}
        {communities.isSuccess && communities.data.length === 0 && (
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">You don&apos;t manage any communities yet. <Link className="text-[var(--color-accent)] hover:underline" href="/communities">Create one</Link>.</p>
        )}
      </div>
      <div>
        <Label>Event</Label>
        <div className="flex gap-2">
          <select className="field-select w-full" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— none —</option>
            {(events.data ?? []).map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
          <Button type="button" variant="secondary" disabled={moveEvent.isPending || eventId === (tournament.eventId ?? '')} onClick={() => moveEvent.mutate()}>
            Apply
          </Button>
        </div>
        {tournament.event && (
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            Currently part of <Link className="text-[var(--color-accent)] hover:underline" href={`/e/${tournament.event.slug}`}>{tournament.event.name}</Link>
          </p>
        )}
      </div>
    </Section>
  );
}

function RankingSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const qc = useQueryClient();
  const [rankingId, setRankingId] = useState(tournament.rankingId ?? '');
  const rankings = useQuery({
    queryKey: ['community-rankings', tournament.communityId],
    enabled: !!token && !!tournament.communityId,
    queryFn: async () => {
      try {
        const res = await api<Ranking[] | { items?: Ranking[] }>(`/communities/${tournament.communityId}/rankings`, { token });
        return Array.isArray(res) ? res : (res.items ?? []);
      } catch {
        return [] as Ranking[];
      }
    },
  });
  const apply = useMutation({
    mutationFn: async () => {
      if (tournament.rankingId && tournament.rankingId !== rankingId) {
        await api(`/rankings/${tournament.rankingId}/tournaments/${tournament.id}`, { method: 'DELETE', token }).catch(() => undefined);
      }
      if (rankingId) {
        await api(`/rankings/${rankingId}/tournaments/${tournament.id}`, { method: 'POST', token, body: JSON.stringify({}) });
      }
    },
    onSuccess: async () => {
      toast.success(rankingId ? 'Linked to ranking' : 'Unlinked from ranking');
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Section title="Ranking (Elo)" description="Match results feed the selected community ranking.">
      {!tournament.communityId ? (
        <p className="text-xs text-[var(--color-muted)]">Move this tournament into a community first to link a ranking.</p>
      ) : (
        <div className="flex gap-2">
          <select className="field-select w-full" value={rankingId} onChange={(e) => setRankingId(e.target.value)}>
            <option value="">— none —</option>
            {(rankings.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.game ? ` · ${r.game.name}` : ''}</option>
            ))}
          </select>
          <Button type="button" variant="secondary" disabled={apply.isPending || rankingId === (tournament.rankingId ?? '')} onClick={() => apply.mutate()} className="gap-1.5">
            <Link2 className="h-4 w-4" /> Apply
          </Button>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

function ReopenSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const qc = useQueryClient();
  const reopen = useMutation({
    mutationFn: () => api(`/tournaments/${tournament.id}/reopen`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Tournament reopened — you can edit results again');
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (tournament.status !== 'COMPLETED') return null;
  return (
    <Section title="Reopen tournament" description="Set the status back to ACTIVE to correct results. Standings recompute automatically as you edit.">
      <Button type="button" variant="secondary" disabled={reopen.isPending} onClick={() => reopen.mutate()} className="gap-1.5">
        <RotateCcw className="h-4 w-4" /> Reopen
      </Button>
    </Section>
  );
}

function DeleteSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [typed, setTyped] = useState('');
  const del = useMutation({
    mutationFn: () => api(`/tournaments/${tournament.id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Tournament deleted');
      await qc.invalidateQueries({ queryKey: ['tournaments-mine'] });
      router.push('/dashboard');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Section
      title="Delete tournament"
      description="Permanently removes the tournament, participants, matches, standings and registrations. This cannot be undone."
      className="border border-red-500/30"
    >
      <p className="flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> Type <code className="font-mono">{tournament.slug}</code> to confirm.</p>
      <div className="flex flex-wrap gap-2">
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={tournament.slug} className="max-w-xs font-mono" />
        <Button
          type="button"
          disabled={typed !== tournament.slug || del.isPending}
          onClick={() => del.mutate()}
          className="gap-1.5 bg-red-600 text-white hover:bg-red-700 hover:text-white"
        >
          <Trash2 className="h-4 w-4" /> Delete forever
        </Button>
      </div>
    </Section>
  );
}
