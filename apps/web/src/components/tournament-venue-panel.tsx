'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';

type VenueType = 'ONLINE' | 'PHYSICAL' | '';

export function TournamentVenuePanel({
  tournament,
  token,
  embedded = false,
}: {
  tournament: Tournament;
  token: string;
  embedded?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(embedded);
  const [venueType, setVenueType] = useState<VenueType>(
    (tournament.venueType as VenueType) ?? '',
  );
  const [venueName, setVenueName] = useState(tournament.venueName ?? '');
  const [venueAddress, setVenueAddress] = useState(tournament.venueAddress ?? '');
  const [venueUrl, setVenueUrl] = useState(tournament.venueUrl ?? '');
  const [msg, setMsg] = useState('');

  const save = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          venueType: venueType || null,
          venueName: venueName.trim() || null,
          venueAddress: venueAddress.trim() || null,
          venueUrl: venueUrl.trim() || null,
        }),
      }),
    onSuccess: async () => {
      setMsg('Venue saved');
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const body = (
    <div className={embedded ? 'space-y-4' : 'panel-card mt-3 space-y-4 rounded-xl p-4'}>
      <p className="text-xs text-[var(--color-muted)]">
        Shown on the public tournament page and match preview share cards.
        Set each match time under Matches → More options.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ['', 'Not set'],
            ['ONLINE', 'Online'],
            ['PHYSICAL', 'Physical venue / field'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value || 'none'}
            type="button"
            onClick={() => setVenueType(value)}
            className={`rounded-xl px-3 py-2 text-left text-sm ${
              venueType === value ? 'choice-btn-active' : 'choice-btn'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {venueType === 'ONLINE' && (
        <>
          <div>
            <Label>Platform name (optional)</Label>
            <Input
              className="mt-1"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Discord, Twitch, etc."
            />
          </div>
          <div>
            <Label>Link or room code</Label>
            <Input
              className="mt-1"
              value={venueUrl}
              onChange={(e) => setVenueUrl(e.target.value)}
              placeholder="https://discord.gg/… or lobby code"
            />
          </div>
        </>
      )}
      {venueType === 'PHYSICAL' && (
        <>
          <div>
            <Label>Venue / field name</Label>
            <Input
              className="mt-1"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="City Sports Arena"
            />
          </div>
          <div>
            <Label>Address (optional)</Label>
            <Input
              className="mt-1"
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="123 Main St, City"
            />
          </div>
        </>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        Save venue
      </Button>
      {msg && <p className="text-xs text-[var(--color-muted)]">{msg}</p>}
    </div>
  );

  if (embedded) return body;

  return (
    <section className="mt-10">
      <button
        type="button"
        className="font-display text-xl font-semibold hover:text-[var(--color-accent)]"
        onClick={() => setOpen((v) => !v)}
      >
        Hosting & venue {open ? '▾' : '▸'}
      </button>
      {open && body}
    </section>
  );
}
