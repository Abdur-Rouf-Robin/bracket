'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SAMPLE_TEAMS, buildPreview, type PreviewFormat } from './generate-preview';
import { MiniBracket } from './mini-bracket';

export function FormatDemo({ format, teamCount = 8 }: { format: PreviewFormat; teamCount?: number }) {
  const [seed, setSeed] = useState(1);
  const preview = useMemo(
    () =>
      buildPreview(format, SAMPLE_TEAMS.slice(0, teamCount), {
        randomize: seed > 1,
        seed,
        thirdPlace: format === 'SINGLE_ELIMINATION',
        groupCount: 2,
        advancePerGroup: 2,
      }),
    [format, seed, teamCount],
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
        <p className="text-xs font-semibold text-[var(--color-muted)]">
          Live demo · {teamCount} sample teams · {preview.matches.length || preview.teams.length} {preview.matches.length ? 'matches' : 'entries'}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSeed((s) => s + 1)}>
          <RefreshCw /> Shuffle
        </Button>
      </div>
      <MiniBracket preview={preview} compact />
    </div>
  );
}
