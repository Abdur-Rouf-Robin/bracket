'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { SportNav } from '@/components/sport-nav';
import { CricketScoreboardPanel } from '@/components/cricket-scoreboard';

export default function FreeCricketLivePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [editToken, setEditToken] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(`cricket-edit-${slug}`);
    if (stored) setEditToken(stored);
  }, [slug]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SportNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/sports/cricket" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            ← Cricket hub
          </Link>
          <span className="text-[var(--color-muted)]">Free scoreboard · /live/{slug}</span>
        </div>
        <CricketScoreboardPanel
          variant="standalone"
          slug={slug}
          editToken={editToken}
          canEdit={!!editToken}
        />
      </main>
    </div>
  );
}
