'use client';

import { useState } from 'react';
import type { ShareCardPayload } from '@bracket/shared';
import { MatchResultView, downloadResultPng } from '@/components/match-result-view';
import { Button } from '@/components/ui/button';

const EXPORT_ID = 'share-match-result-export';

export function ShareMatchCard({
  payload,
  onClose,
}: {
  payload: ShareCardPayload;
  onClose: () => void;
}) {
  const [exporting, setExporting] = useState(false);

  async function drawAndDownload() {
    setExporting(true);
    try {
      await downloadResultPng(
        EXPORT_ID,
        `result-${payload.home.name.slice(0, 12)}-vs-${payload.away.name.slice(0, 12)}.png`,
      );
    } catch {
      alert('Could not export image. Try a screenshot.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-2xl">
        <h3 className="font-display text-xl font-bold">Shareable result</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {payload.displayMode === 'percent'
            ? 'Vote share result'
            : payload.displayMode === 'both'
              ? 'Score + vote share'
              : 'Score result'}
          {' · '}
          {payload.roundLabel}
        </p>

        <div className="mt-4">
          <MatchResultView
            data={payload}
            variant="share"
            exportId={EXPORT_ID}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={drawAndDownload} disabled={exporting}>
            {exporting ? 'Saving…' : 'Download image'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
