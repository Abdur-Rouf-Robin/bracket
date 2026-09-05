'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { parseEmbedOptions, TournamentEmbedView } from '@/components/sharing/tournament-embed-view';

function EmbedInner() {
  const params = useParams<{ slug: string }>();
  const sp = useSearchParams();
  return <TournamentEmbedView slug={params.slug} options={parseEmbedOptions(sp)} />;
}

export default function EmbedTournamentPage() {
  return (
    <Suspense fallback={null}>
      <EmbedInner />
    </Suspense>
  );
}
