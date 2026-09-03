'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SHARE_IMAGE_ASSET_SPECS } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { ImageUrlField } from '@/components/image-url-field';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';

export function TournamentMediaPanel({
  tournament,
  token,
}: {
  tournament: Tournament;
  token: string;
}) {
  const qc = useQueryClient();
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(
    (tournament as Tournament & { backgroundImageUrl?: string | null })
      .backgroundImageUrl ?? '',
  );
  const [logoUrl, setLogoUrl] = useState(
    (tournament as Tournament & { logoUrl?: string | null }).logoUrl ?? '',
  );
  const [msg, setMsg] = useState('');

  const saveTournament = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          backgroundImageUrl: backgroundImageUrl.trim() || null,
          logoUrl: logoUrl.trim() || null,
        }),
      }),
    onSuccess: async () => {
      setMsg('Tournament images saved');
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <div className="panel-card space-y-4 rounded-xl p-4">
      <div>
        <h3 className="font-display text-lg font-semibold">Share image assets</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Paste image URLs for backgrounds and logos used on pre-match, result,
          MVP, and congrats cards.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ImageUrlField
          label={SHARE_IMAGE_ASSET_SPECS.tournament.backgroundImageUrl.label}
          hint={`${SHARE_IMAGE_ASSET_SPECS.tournament.backgroundImageUrl.minSize} · ${SHARE_IMAGE_ASSET_SPECS.tournament.backgroundImageUrl.ratio}`}
          value={backgroundImageUrl}
          onChange={setBackgroundImageUrl}
          token={token}
        />
        <ImageUrlField
          label={SHARE_IMAGE_ASSET_SPECS.tournament.logoUrl.label}
          hint={SHARE_IMAGE_ASSET_SPECS.tournament.logoUrl.minSize}
          value={logoUrl}
          onChange={setLogoUrl}
          token={token}
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={saveTournament.isPending}
        onClick={() => saveTournament.mutate()}
      >
        Save tournament images
      </Button>

      {msg && <p className="text-xs text-[var(--color-muted)]">{msg}</p>}
    </div>
  );
}
