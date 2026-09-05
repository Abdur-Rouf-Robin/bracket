'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Shuffle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  PREVIEW_FORMAT_OPTIONS,
  SAMPLE_TEAMS,
  matchCount,
  parseParticipants,
  type PreviewFormat,
} from './generate-preview';

export const GENERATOR_DRAFT_KEY = 'bracket:generator-draft';

export type GeneratorDraft = {
  name?: string;
  format: PreviewFormat;
  participants: string[];
  randomize?: boolean;
  thirdPlace?: boolean;
  savedAt: number;
};

export function saveGeneratorDraft(draft: Omit<GeneratorDraft, 'savedAt'>) {
  try {
    sessionStorage.setItem(
      GENERATOR_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() } satisfies GeneratorDraft),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function readGeneratorDraft(): GeneratorDraft | null {
  try {
    const raw = sessionStorage.getItem(GENERATOR_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeneratorDraft;
    if (!parsed || !Array.isArray(parsed.participants)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGeneratorDraft() {
  try {
    sessionStorage.removeItem(GENERATOR_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Homepage widget: paste names, pick a format, jump to the generator. */
export function QuickStart({ className }: { className?: string }) {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [format, setFormat] = useState<PreviewFormat>('SINGLE_ELIMINATION');
  const names = useMemo(() => parseParticipants(raw), [raw]);
  const count = names.length;
  const matches = matchCount(format, count);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (count < 2) return;
    saveGeneratorDraft({ format, participants: names, randomize: false, thirdPlace: false });
    router.push('/bracket-generator');
  }

  return (
    <form
      onSubmit={submit}
      className={`gaming-card relative overflow-hidden rounded-2xl p-5 ${className ?? ''}`}
      aria-labelledby="quick-start-title"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p id="quick-start-title" className="font-display text-sm font-bold">
            Quick start
          </p>
          <p className="text-xs text-[var(--color-muted)]">No account needed. Paste names, get a bracket.</p>
        </div>
        <span className="badge badge-accent">Free</span>
      </div>

      <Label htmlFor="quick-start-names">Participants — one per line</Label>
      <Textarea
        id="quick-start-names"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={SAMPLE_TEAMS.slice(0, 4).join('\n')}
        className="min-h-32 resize-y font-mono text-xs"
        spellCheck={false}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" aria-hidden />
          {count} participant{count === 1 ? '' : 's'}
          {count >= 2 && <> · {matches} match{matches === 1 ? '' : 'es'}</>}
        </span>
        <button
          type="button"
          onClick={() => setRaw(SAMPLE_TEAMS.join('\n'))}
          className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
        >
          <Shuffle className="size-3.5" aria-hidden /> Use sample names
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="quick-start-format">Format</Label>
          <Select
            value={format}
            onChange={(v) => setFormat((v || 'SINGLE_ELIMINATION') as PreviewFormat)}
            options={PREVIEW_FORMAT_OPTIONS}
          />
        </div>
        <Button type="submit" size="lg" disabled={count < 2} className="gaming-glow">
          Generate <ArrowRight />
        </Button>
      </div>
    </form>
  );
}
