'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, Plus, Trash2, X } from 'lucide-react';
import { isHexColor } from '@bracket/shared';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUrlField } from '@/components/image-url-field';
import { Markdown } from './markdown';
import { contrastText } from './brand-style';
import {
  PremierBadge,
  Section,
  Toggle,
  settingsOf,
  useSaveSettings,
  useSaveTournament,
  webOrigin,
} from './panel-kit';

const SOCIAL_KEYS = [
  { key: 'site', label: 'Website', placeholder: 'https://…' },
  { key: 'x', label: 'X / Twitter', placeholder: 'https://x.com/…' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/…' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/…' },
  { key: 'twitch', label: 'Twitch', placeholder: 'https://twitch.tv/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
] as const;

const LANGS = [
  ['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['fr', 'Français'], ['de', 'Deutsch'],
  ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['ru', 'Русский'],
  ['ar', 'العربية'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['ja', '日本語'], ['ko', '한국어'], ['zh', '中文'],
] as const;

type Sponsor = { name: string; logoUrl?: string | null; url?: string | null };

/**
 * Branding settings: colors, logo/background, custom slug, hide-branding
 * (Premier), sponsors, stream URL, prize pool, rules (markdown), description
 * translations and social links.
 */
export function BrandingPanel({
  tournament,
  token,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  sub: string;
}) {
  return (
    <div className="space-y-6">
      <ColorsSection tournament={tournament} token={token} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ImagesSection tournament={tournament} token={token} />
        <SlugSection tournament={tournament} token={token} />
      </div>
      <BrandingToggleSection tournament={tournament} token={token} />
      <div className="grid gap-6 lg:grid-cols-2">
        <StreamPrizeSection tournament={tournament} token={token} />
        <SocialSection tournament={tournament} token={token} />
      </div>
      <SponsorsSection tournament={tournament} token={token} />
      <RulesSection tournament={tournament} token={token} />
      <TranslationsSection tournament={tournament} token={token} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ColorsSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const [primary, setPrimary] = useState(s.brandPrimaryColor ?? '');
  const [secondary, setSecondary] = useState(s.brandSecondaryColor ?? '');

  const p = isHexColor(primary) ? primary : '#22d3ee';
  const sec = isHexColor(secondary) ? secondary : '#a855f7';

  return (
    <Section
      title="Brand colors"
      description="Applied to buttons, highlights and the live bracket on your public page, embeds and TV display."
      actions={
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => { setPrimary(''); setSecondary(''); }}>
            Reset
          </Button>
          <Button
            type="button"
            disabled={save.isPending || (!!primary && !isHexColor(primary)) || (!!secondary && !isHexColor(secondary))}
            onClick={() => save.mutate({ brandPrimaryColor: primary || null, brandSecondaryColor: secondary || null })}
          >
            Save colors
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr]">
        <ColorField label="Primary color" value={primary} onChange={setPrimary} fallback="#22d3ee" />
        <ColorField label="Secondary color" value={secondary} onChange={setSecondary} fallback="#a855f7" />
        <div>
          <Label>Preview</Label>
          <div className="space-y-2 rounded-xl border border-[var(--color-line)] p-3" style={{ ['--color-accent' as string]: p }}>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full" style={{ background: p }} />
              <span className="h-8 w-8 rounded-full" style={{ background: sec }} />
              <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: p, color: contrastText(p) }}>
                Primary button
              </span>
              <span className="rounded-md border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: sec, color: sec }}>
                Secondary
              </span>
            </div>
            <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${p}, ${sec})` }} />
            <p className="text-[11px] text-[var(--color-muted)]">
              Winner highlight · <span style={{ color: p }} className="font-semibold">Team Alpha 3</span> – Team Beta 1
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function ColorField({ label, value, onChange, fallback }: { label: string; value: string; onChange: (v: string) => void; fallback: string }) {
  const valid = !value || isHexColor(value);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isHexColor(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-[var(--color-line)] bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={fallback} className="font-mono" />
      </div>
      {!valid && <p className="mt-1 text-[11px] text-red-500">Use a hex color like #1e90ff</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ImagesSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const save = useSaveTournament(tournament, token);
  const [logoUrl, setLogoUrl] = useState(tournament.logoUrl ?? '');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(tournament.backgroundImageUrl ?? '');
  return (
    <Section
      title="Logo & background"
      description="Shown on the public page header, TV display, print/PDF exports and share cards."
      actions={
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(
              { logoUrl: logoUrl.trim() || null, backgroundImageUrl: backgroundImageUrl.trim() || null },
              { onSuccess: () => toast.success('Images saved') },
            )
          }
        >
          Save images
        </Button>
      }
    >
      <ImageUrlField label="Logo" hint="Square, at least 256×256" value={logoUrl} onChange={setLogoUrl} token={token} />
      <ImageUrlField label="Background image" hint="1920×1080 recommended" value={backgroundImageUrl} onChange={setBackgroundImageUrl} token={token} />
    </Section>
  );
}

// ---------------------------------------------------------------------------

function SlugSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const router = useRouter();
  const save = useSaveTournament(tournament, token);
  const [slug, setSlug] = useState(tournament.slug);
  const [confirm, setConfirm] = useState(false);
  const cleaned = slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const valid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned) && cleaned.length >= 2 && cleaned.length <= 80;
  const changed = cleaned !== tournament.slug;

  const availability = useQuery({
    queryKey: ['slug-available', cleaned],
    enabled: valid && changed,
    queryFn: async () => {
      try {
        await api(`/t/${cleaned}`, { viewToken: null });
        return false; // exists
      } catch (e) {
        const status = (e as { status?: number }).status;
        return status === 404;
      }
    },
  });

  return (
    <Section
      title="Custom URL"
      description="Pick a memorable link. Changing it breaks previously shared links and QR codes."
    >
      <div>
        <Label>Slug</Label>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-[var(--color-muted)]">{webOrigin()}/t/</span>
          <Input value={slug} onChange={(e) => { setSlug(e.target.value); setConfirm(false); }} className="font-mono" />
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px]">
          {!valid && slug ? (
            <span className="text-red-500">Use 2–80 lowercase letters, numbers and hyphens.</span>
          ) : !changed ? (
            <span className="text-[var(--color-muted)]">This is your current URL.</span>
          ) : availability.isLoading ? (
            <span className="text-[var(--color-muted)]">Checking availability…</span>
          ) : availability.data ? (
            <span className="flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" /> Available: {webOrigin()}/t/{cleaned}</span>
          ) : (
            <span className="flex items-center gap-1 text-red-500"><X className="h-3 w-3" /> Already taken (a suffix would be added)</span>
          )}
        </p>
      </div>
      {changed && valid && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
          <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Old links will stop working</p>
          <p>Anyone using <code>/t/{tournament.slug}</code>, printed QR codes or embeds will need the new URL.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I understand
          </label>
        </div>
      )}
      <Button
        type="button"
        disabled={!changed || !valid || !confirm || save.isPending}
        onClick={() =>
          save.mutate(
            { slug: cleaned },
            {
              onSuccess: (t) => {
                toast.success(`URL changed to /t/${t.slug}`);
                router.replace(`/t/${t.slug}/manage?tab=settings&sub=branding`);
              },
            },
          )
        }
      >
        Change URL
      </Button>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function BrandingToggleSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const premier = tournament.viewerPlan === 'PREMIER';
  return (
    <Section title="Powered-by branding">
      <Toggle
        checked={!!s.hideBranding}
        onChange={(v) => save.mutate({ hideBranding: v })}
        label="Hide “Powered by Bracket”"
        badge={<PremierBadge />}
        description={
          premier
            ? 'Removes Bracket branding from your public page, embeds, TV display and PDF footers.'
            : 'Saved for when you upgrade — branding stays visible on the Free plan.'
        }
      />
      {!premier && s.hideBranding && (
        <p className="text-[11px] text-amber-700">
          This setting is stored but not applied until your account is on Premier.
        </p>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

function StreamPrizeSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const [streamUrl, setStreamUrl] = useState(s.streamUrl ?? '');
  const [prizePool, setPrizePool] = useState(s.prizePool ?? '');
  return (
    <Section
      title="Stream & prize pool"
      actions={
        <Button type="button" variant="secondary" disabled={save.isPending} onClick={() => save.mutate({ streamUrl: streamUrl.trim() || null, prizePool: prizePool.trim() || null })}>
          Save
        </Button>
      }
    >
      <div>
        <Label>Live stream URL</Label>
        <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://twitch.tv/… or YouTube link" />
      </div>
      <div>
        <Label>Prize pool</Label>
        <Input value={prizePool} onChange={(e) => setPrizePool(e.target.value)} placeholder="e.g. $500 · 1st $300, 2nd $150, 3rd $50" maxLength={240} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function SocialSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const [links, setLinks] = useState<Record<string, string>>({ ...(s.socialLinks ?? {}) });
  return (
    <Section
      title="Social links"
      description="Shown on the public tournament page."
      actions={
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={() => {
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(links)) if (v.trim()) clean[k] = v.trim();
            save.mutate({ socialLinks: clean });
          }}
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {SOCIAL_KEYS.map((k) => (
          <div key={k.key}>
            <Label>{k.label}</Label>
            <Input value={links[k.key] ?? ''} placeholder={k.placeholder} onChange={(e) => setLinks({ ...links, [k.key]: e.target.value })} />
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function SponsorsSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const [sponsors, setSponsors] = useState<Sponsor[]>(() => (s.sponsors ?? []).map((x) => ({ ...x })));

  function update(i: number, patch: Partial<Sponsor>) {
    setSponsors((prev) => prev.map((sp, idx) => (idx === i ? { ...sp, ...patch } : sp)));
  }

  return (
    <Section
      title="Sponsors"
      description="Logos appear on the public page footer and TV display."
      actions={
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="gap-1" onClick={() => setSponsors([...sponsors, { name: '', logoUrl: '', url: '' }])}>
            <Plus className="h-4 w-4" /> Add sponsor
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending || sponsors.some((sp) => !sp.name.trim())}
            onClick={() =>
              save.mutate({
                sponsors: sponsors.map((sp) => ({ name: sp.name.trim(), logoUrl: sp.logoUrl?.trim() || null, url: sp.url?.trim() || null })),
              })
            }
          >
            Save sponsors
          </Button>
        </div>
      }
    >
      {sponsors.length === 0 && <p className="text-xs text-[var(--color-muted)]">No sponsors yet.</p>}
      <div className="space-y-3">
        {sponsors.map((sp, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-[var(--color-line)] p-3 md:grid-cols-[1fr_1.4fr_1.4fr_auto]">
            <div>
              <Label>Name</Label>
              <Input value={sp.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={80} />
            </div>
            <ImageUrlField label="Logo" value={sp.logoUrl ?? ''} onChange={(v) => update(i, { logoUrl: v })} token={token} />
            <div>
              <Label>Link</Label>
              <Input value={sp.url ?? ''} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="ghost" onClick={() => setSponsors(sponsors.filter((_, idx) => idx !== i))} aria-label="Remove sponsor">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function RulesSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const [rules, setRules] = useState(s.rulesMarkdown ?? '');
  const [preview, setPreview] = useState(false);
  return (
    <Section
      title="Rules"
      description="Markdown supported: # headings, **bold**, *italic*, - lists, 1. numbered lists, [links](https://…)."
      actions={
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setPreview(!preview)}>
            {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button type="button" variant="secondary" disabled={save.isPending} onClick={() => save.mutate({ rulesMarkdown: rules.trim() || null })}>
            Save rules
          </Button>
        </div>
      }
    >
      {preview ? (
        <div className="rounded-lg border border-[var(--color-line)] p-4">
          {rules.trim() ? <Markdown source={rules} /> : <p className="text-xs text-[var(--color-muted)]">Nothing to preview.</p>}
        </div>
      ) : (
        <textarea className="field-textarea w-full font-mono text-xs" rows={12} value={rules} onChange={(e) => setRules(e.target.value)} maxLength={20000} placeholder={'# Rules\n\n1. Matches are best of 3\n2. **Check-in** closes 15 minutes before start\n\n- Be respectful\n- Report scores promptly'} />
      )}
      <p className="text-right text-[11px] text-[var(--color-muted)]">{rules.length} / 20000</p>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function TranslationsSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const [tr, setTr] = useState<Record<string, string>>({ ...(s.descriptionTranslations ?? {}) });
  const [newLang, setNewLang] = useState('');
  const used = useMemo(() => new Set(Object.keys(tr)), [tr]);
  const available = LANGS.filter(([code]) => !used.has(code));
  useEffect(() => {
    if (!newLang && available.length) setNewLang(available[0][0]);
  }, [available, newLang]);

  return (
    <Section
      title="Multi-lingual descriptions"
      description="Provide translated descriptions; visitors see the version matching their browser language when available."
      actions={
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={() => {
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(tr)) if (v.trim()) clean[k] = v.trim().slice(0, 4000);
            save.mutate({ descriptionTranslations: clean });
          }}
        >
          Save translations
        </Button>
      }
    >
      <div className="rounded-lg border border-dashed border-[var(--color-line)] p-3 text-xs text-[var(--color-muted)]">
        <span className="font-semibold text-[var(--color-ink)]">Default:</span> {tournament.description || '— no description yet —'}
      </div>
      {Object.entries(tr).map(([code, text]) => (
        <div key={code} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="mb-0">{LANGS.find(([c]) => c === code)?.[1] ?? code} <span className="font-mono text-[10px]">({code})</span></Label>
            <Button type="button" variant="ghost" className="px-2 py-1" onClick={() => { const next = { ...tr }; delete next[code]; setTr(next); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <textarea className="field-textarea w-full text-sm" rows={3} value={text} maxLength={4000} onChange={(e) => setTr({ ...tr, [code]: e.target.value })} />
        </div>
      ))}
      {available.length > 0 && (
        <div className="flex items-end gap-2">
          <div>
            <Label>Add language</Label>
            <select className="field-select" value={newLang} onChange={(e) => setNewLang(e.target.value)}>
              {available.map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>
          <Button type="button" variant="secondary" className="gap-1" onClick={() => { if (newLang) { setTr({ ...tr, [newLang]: '' }); setNewLang(''); } }}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      )}
    </Section>
  );
}
