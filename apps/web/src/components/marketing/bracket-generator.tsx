'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Save, Shuffle, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { downloadElementPng } from '@/lib/export-png';
import type { Tournament } from '@/lib/types';
import {
  PREVIEW_FORMAT_OPTIONS,
  SAMPLE_TEAMS,
  apiFormatFor,
  buildPreview,
  matchCount,
  parseParticipants,
  type PreviewFormat,
} from './generate-preview';
import { MiniBracket } from './mini-bracket';
import { clearGeneratorDraft, readGeneratorDraft, saveGeneratorDraft } from './quick-start';

const EXPORT_ID = 'bracket-generator-export';

function placeholderNames(size: number): string[] {
  return Array.from({ length: size }, (_, i) => `Participant ${i + 1}`);
}

export function BracketGenerator() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [name, setName] = useState('My tournament');
  const [format, setFormat] = useState<PreviewFormat>('SINGLE_ELIMINATION');
  const [mode, setMode] = useState<'names' | 'size'>('names');
  const [raw, setRaw] = useState(SAMPLE_TEAMS.join('\n'));
  const [size, setSize] = useState(8);
  const [randomize, setRandomize] = useState(false);
  const [thirdPlace, setThirdPlace] = useState(false);
  const [seed, setSeed] = useState(1);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const draft = readGeneratorDraft();
    if (draft) {
      setFormat(draft.format);
      setRaw(draft.participants.join('\n'));
      setRandomize(!!draft.randomize);
      setThirdPlace(!!draft.thirdPlace);
      if (draft.name) setName(draft.name);
      setMode('names');
      setRestored(true);
    }
  }, []);

  const names = useMemo(
    () => (mode === 'names' ? parseParticipants(raw) : placeholderNames(size)),
    [mode, raw, size],
  );

  const preview = useMemo(
    () => buildPreview(format, names, { randomize, seed, thirdPlace }),
    [format, names, randomize, seed, thirdPlace],
  );

  const total = matchCount(format, names.length, { thirdPlace });
  const isElim = format === 'SINGLE_ELIMINATION' || format === 'DOUBLE_ELIMINATION';

  function shuffle() {
    setRandomize(true);
    setSeed((s) => s + 1);
  }

  async function downloadPng() {
    try {
      await downloadElementPng(EXPORT_ID, `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'bracket'}.png`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export image');
    }
  }

  async function saveOnline() {
    if (names.length < 2) {
      toast.error('Add at least two participants first.');
      return;
    }
    if (!user || !token) {
      saveGeneratorDraft({ name, format, participants: names, randomize, thirdPlace });
      toast('Sign up to save — your bracket will be waiting when you return.');
      router.push(`/register?next=${encodeURIComponent('/bracket-generator')}`);
      return;
    }
    setSaving(true);
    try {
      const teamNames = preview.teams.map((t) => t.name);
      const isGroups = format === 'GROUPS_KNOCKOUT';
      const t = await api<Tournament>('/tournaments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim() || 'My tournament',
          settings: {
            stageMode: isGroups ? 'TWO_STAGE' : 'SINGLE',
            singleStageFormat: isGroups ? 'SINGLE_ELIMINATION' : apiFormatFor(format),
            breakTiesWithPlacement: isElim ? thirdPlace : false,
            seedingMode: 'LIST_ORDER',
            maxParticipants: Math.max(2, Math.min(512, teamNames.length)),
          },
        }),
      });
      await api(`/tournaments/${t.id}/teams`, {
        method: 'POST',
        token,
        body: JSON.stringify({ teams: teamNames.map((n) => ({ name: n })) }),
      });
      await api(`/tournaments/${t.id}/generate`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          format: apiFormatFor(format),
          ...(isGroups ? { groupCount: Math.max(2, Math.round(teamNames.length / 4)), advancePerGroup: 2 } : {}),
        }),
      });
      clearGeneratorDraft();
      toast.success('Tournament saved — you can manage it online now.');
      router.push(`/t/${t.slug}/manage`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save tournament');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="card no-print h-fit space-y-5 p-5 lg:sticky lg:top-24">
        {restored && (
          <p className="rounded-md bg-[var(--color-accent)]/10 px-3 py-2 text-xs text-[var(--color-accent)]">
            Restored your draft from earlier.
          </p>
        )}
        <div>
          <Label htmlFor="gen-name">Tournament name</Label>
          <Input id="gen-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label htmlFor="gen-format">Format</Label>
          <Select value={format} onChange={(v) => setFormat((v || 'SINGLE_ELIMINATION') as PreviewFormat)} options={PREVIEW_FORMAT_OPTIONS} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="mb-0">Participants</Label>
            <div className="inline-flex rounded-md border border-[var(--color-line)] p-0.5 text-xs">
              {(['names', 'size'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded px-2 py-0.5 font-semibold ${mode === m ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]' : 'text-[var(--color-muted)]'}`}
                >
                  {m === 'names' ? 'Names' : 'Size'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'names' ? (
            <>
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="One participant per line"
                className="min-h-44 font-mono text-xs"
                spellCheck={false}
                aria-label="Participants, one per line"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--color-muted)]">
                <span>{names.length} participants</span>
                <button type="button" className="text-[var(--color-accent)] hover:underline" onClick={() => setRaw(SAMPLE_TEAMS.join('\n'))}>
                  Sample names
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={2}
                max={128}
                value={size}
                onChange={(e) => setSize(Math.max(2, Math.min(128, Number(e.target.value) || 2)))}
                aria-label="Bracket size"
                className="w-24"
              />
              <div className="flex flex-wrap gap-1">
                {[4, 8, 16, 32, 64].map((n) => (
                  <button key={n} type="button" onClick={() => setSize(n)} className={`rounded-md border px-2 py-1 text-xs font-semibold ${size === n ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2"><Shuffle className="size-4 text-[var(--color-muted)]" aria-hidden /> Randomize seeds</span>
            <Switch checked={randomize} onCheckedChange={(v) => { setRandomize(v); if (v) setSeed((s) => s + 1); }} aria-label="Randomize seeds" />
          </label>
          {isElim && format === 'SINGLE_ELIMINATION' && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={thirdPlace} onCheckedChange={(v) => setThirdPlace(v === true)} id="gen-third" />
              <span>Third-place match</span>
            </label>
          )}
        </div>

        <div className="rounded-lg bg-[var(--color-surface)] p-3 text-xs text-[var(--color-muted)]">
          <p><span className="font-semibold text-[var(--color-ink)]">{names.length}</span> participants → <span className="font-semibold text-[var(--color-ink)]">{total}</span> matches</p>
          {isElim && <p className="mt-1">Bracket size {2 ** Math.ceil(Math.log2(Math.max(2, names.length)))} · {2 ** Math.ceil(Math.log2(Math.max(2, names.length))) - names.length} byes</p>}
        </div>

        <div className="grid gap-2">
          <Button variant="secondary" onClick={shuffle}><Wand2 /> Reshuffle</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
            <Button variant="outline" onClick={downloadPng}><Download /> PNG</Button>
          </div>
          <Button onClick={saveOnline} loading={saving} className="gaming-glow">
            <Save /> Save & manage online
          </Button>
          <p className="text-center text-[11px] text-[var(--color-muted)]">
            {user ? 'Creates a live tournament you can run from any device.' : 'Free account · live results, sign-ups, sharing.'}
          </p>
        </div>
      </aside>

      <section className="min-w-0">
        <div id="print-root" className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] px-4 py-3">
            <div>
              <h2 className="font-display text-lg font-bold">{name || 'Bracket'}</h2>
              <p className="text-xs text-[var(--color-muted)]">
                {PREVIEW_FORMAT_OPTIONS.find((o) => o.value === format)?.label} · {names.length} participants · {total} matches
              </p>
            </div>
            <span className="badge badge-neutral">Preview</span>
          </div>
          <MiniBracket preview={preview} id={EXPORT_ID} />
        </div>
        <div className="no-print card mt-4 flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 text-[var(--color-accent)]" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Want live scores, sign-ups and sharing?</p>
              <p className="text-xs text-[var(--color-muted)]">Save this bracket to run it online — free for up to 256 participants.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/features">See what you get</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
