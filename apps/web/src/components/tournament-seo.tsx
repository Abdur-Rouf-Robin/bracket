'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';

/** Applies noindex when tournament excludes search engines. */
export function TournamentSeo({ slug }: { slug: string }) {
  const { data } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api<Tournament>(`/t/${slug}`),
  });

  useEffect(() => {
    const exclude = (data?.settings as { excludeFromSearchEngines?: boolean })
      ?.excludeFromSearchEngines;
    let el = document.querySelector('meta[name="robots"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', exclude ? 'noindex,nofollow' : 'index,follow');
  }, [data]);

  return null;
}

export default function SeoBridge() {
  const params = useParams<{ slug: string }>();
  return <TournamentSeo slug={params.slug} />;
}
