'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  SymmetricalBracket,
  downloadBracketPng,
  printBracket,
} from '@/components/symmetrical-bracket/symmetrical-bracket';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import { useTournamentLive } from '@/lib/use-tournament-live';

const BRACKET_FORMATS = new Set([
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'GROUPS_KNOCKOUT',
]);

export default function ShareBracketPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { token } = useAuth();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () =>
      api<Tournament>(`/t/${slug}`, { token: token ?? undefined }),
  });

  useTournamentLive(data?.id, slug);

  const exportId = 'share-bracket-export';

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function saveImage() {
    setExporting(true);
    try {
      await downloadBracketPng(
        exportId,
        `${data?.slug ?? 'bracket'}-knockout.png`,
      );
    } catch {
      alert('Could not export image. Try a screenshot or use Share link.');
    } finally {
      setExporting(false);
    }
  }

  const knockoutMatches =
    data?.format === 'GROUPS_KNOCKOUT'
      ? data.matches.filter((m) => m.bracketSide !== 'GROUP')
      : data?.matches ?? [];

  const bracketTournament =
    data && data.format === 'GROUPS_KNOCKOUT'
      ? { ...data, matches: knockoutMatches }
      : data;

  return (
    <div className="min-h-screen bg-[#0a0c10]">
      <header className="no-print sticky top-0 z-10 border-b border-[var(--color-line)] bg-[#0a0c10]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link
              href={`/t/${slug}`}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              ← Back to tournament
            </Link>
            <h1 className="font-display text-lg font-bold text-white">
              {data?.name ?? 'Bracket'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={copyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <Button type="button" onClick={saveImage} disabled={exporting || !data}>
              {exporting ? 'Saving…' : 'Download PNG'}
            </Button>
            <Button variant="secondary" type="button" onClick={() => printBracket()}>
              Print
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {isLoading && (
          <p className="text-[var(--color-muted)]">Loading bracket…</p>
        )}
        {error && (
          <p className="text-red-400">
            {error instanceof Error ? error.message : 'Not found'}
          </p>
        )}
        {data && !BRACKET_FORMATS.has(data.format ?? '') && (
          <p className="text-[var(--color-muted)]">
            Bracket tree view is available for knockout formats only.
          </p>
        )}
        {data?.previewHidden && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-[var(--color-muted)]">
            Bracket preview is hidden until the host reveals it.
          </p>
        )}
        {bracketTournament &&
          !bracketTournament.previewHidden &&
          BRACKET_FORMATS.has(bracketTournament.format ?? '') && (
            <SymmetricalBracket
              tournament={bracketTournament}
              exportId={exportId}
            />
          )}
      </main>
    </div>
  );
}
