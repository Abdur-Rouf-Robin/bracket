'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  Lock,
  Monitor,
  QrCode,
  Share2,
  Upload,
  Users,
} from 'lucide-react';
import {
  EMBED_TABS,
  EMBED_THEMES,
  embedQueryString,
  socialShareLinks,
  type EmbedTab,
  type EmbedTheme,
  type ImportPreview,
} from '@bracket/shared';
import { api, API_URL } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCodeCard } from '@/components/qr-code-card';
import {
  CopyButton,
  CopyField,
  DownloadLink,
  Section,
  Toggle,
  managerDownloadHref,
  settingsOf,
  useSaveSettings,
  webOrigin,
} from './panel-kit';

const SOCIALS: { key: keyof ReturnType<typeof socialShareLinks>; label: string; color: string }[] = [
  { key: 'x', label: 'X / Twitter', color: '#000000' },
  { key: 'facebook', label: 'Facebook', color: '#1877f2' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#25d366' },
  { key: 'telegram', label: 'Telegram', color: '#229ed9' },
  { key: 'email', label: 'Email', color: '#6b7280' },
];

/**
 * Sharing & embed settings: share links, social buttons, QR, embed builder,
 * TV display, print/PDF/CSV exports, CSV import, spectator password,
 * participant access pages and SEO toggles.
 */
export function SharingPanel({
  tournament,
  token,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  sub: string;
}) {
  const origin = webOrigin();
  const shareUrl = `${origin}/t/${tournament.slug}`;
  const shareText = `${tournament.name} — live bracket & results`;
  const socials = socialShareLinks(shareUrl, shareText);

  return (
    <div className="space-y-6">
      <Section
        title="Share link"
        description="Anyone with this link can follow the tournament (unless you enable password protection below)."
      >
        <CopyField value={shareUrl} />
        <div className="flex flex-wrap gap-2">
          {SOCIALS.map((s) => (
            <a
              key={s.key}
              href={socials[s.key]}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-accent)]/50"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </a>
          ))}
          <Link
            href={`/t/${tournament.slug}/results`}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-accent)]/50"
          >
            <Share2 className="h-3.5 w-3.5" /> Results page
          </Link>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="QR code"
          description="Print it on posters or show it on a screen — spectators scan to open the live bracket."
        >
          <QrCodeCard
            url={shareUrl}
            size={160}
            filename={`${tournament.slug}-qr`}
            pdfHref={`${API_URL}/t/${tournament.slug}/qr-poster.pdf`}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <a className="text-[var(--color-accent)] hover:underline" href={`${API_URL}/t/${tournament.slug}/qr.png?size=1024`} target="_blank" rel="noreferrer">
              PNG (1024px)
            </a>
            <a className="text-[var(--color-accent)] hover:underline" href={`${API_URL}/t/${tournament.slug}/qr.svg`} target="_blank" rel="noreferrer">
              SVG
            </a>
            <Link className="text-[var(--color-accent)] hover:underline" href={`/t/${tournament.slug}/qr`}>
              Poster page
            </Link>
          </div>
        </Section>

        <TvSection tournament={tournament} token={token} origin={origin} />
      </div>

      <EmbedBuilder tournament={tournament} origin={origin} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Print & PDF" description="Server-rendered A4 PDFs — great for notice boards and referees.">
          <div className="grid gap-2">
            <DownloadLink href={`/t/${tournament.slug}/print`}>
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Print page (choose sections)</span>
              <ExternalLink className="h-3.5 w-3.5 text-[var(--color-muted)]" />
            </DownloadLink>
            {(['bracket', 'standings', 'matches', 'schedule', 'participants'] as const).map((k) => (
              <DownloadLink key={k} href={`${API_URL}/t/${tournament.slug}/export/${k}.pdf`}>
                <span className="flex items-center gap-2 capitalize"><FileText className="h-4 w-4" /> {k}.pdf</span>
                <Download className="h-3.5 w-3.5 text-[var(--color-muted)]" />
              </DownloadLink>
            ))}
          </div>
        </Section>

        <Section title="CSV exports" description="Open in Excel / Google Sheets. Manager exports include private fields.">
          <div className="grid gap-2">
            {(['participants', 'registrations', 'matches', 'standings', 'player-stats'] as const).map((k) => (
              <DownloadLink key={k} href={managerDownloadHref(`/tournaments/${tournament.id}/export/${k}.csv`, token)}>
                <span className="flex items-center gap-2 capitalize"><FileSpreadsheet className="h-4 w-4" /> {k.replace('-', ' ')}.csv</span>
                <Download className="h-3.5 w-3.5 text-[var(--color-muted)]" />
              </DownloadLink>
            ))}
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">
            Public CSVs (participants, matches, standings) are also available at{' '}
            <code className="font-mono">{`${API_URL}/t/${tournament.slug}/export/<kind>.csv`}</code>
          </p>
        </Section>
      </div>

      <ImportSection tournament={tournament} token={token} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PasswordSection tournament={tournament} token={token} />
        <ParticipantAccessSection tournament={tournament} token={token} />
      </div>

      <SeoSection tournament={tournament} token={token} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function TvSection({ tournament, token, origin }: { tournament: Tournament; token?: string; origin: string }) {
  const s = settingsOf(tournament);
  const [interval, setIntervalSec] = useState(String(s.tvDisplayIntervalSeconds ?? 20));
  const save = useSaveSettings(tournament, token);
  const tvUrl = `${origin}/t/${tournament.slug}/tv`;
  return (
    <Section
      title="TV display"
      description="Full-screen auto-cycling slides (standings, bracket, upcoming, results). Perfect for venue screens."
    >
      <CopyField value={tvUrl} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Seconds per slide</Label>
          <Input
            type="number"
            min={5}
            max={300}
            value={interval}
            onChange={(e) => setIntervalSec(e.target.value)}
            className="w-28"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={() => {
            const n = Math.min(300, Math.max(5, Number(interval) || 20));
            save.mutate({ tvDisplayIntervalSeconds: n });
          }}
        >
          Save interval
        </Button>
        <a
          href={tvUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#041018]"
        >
          <Monitor className="h-4 w-4" /> Open on this screen
        </a>
      </div>
      <p className="text-[11px] text-[var(--color-muted)]">
        Tips: press <kbd>F11</kbd> for fullscreen; use <kbd>←</kbd>/<kbd>→</kbd>/<kbd>space</kbd> to control slides. Override with <code>?interval=15&amp;slides=standings,bracket</code>.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function EmbedBuilder({ tournament, origin }: { tournament: Tournament; origin: string }) {
  const s = settingsOf(tournament);
  const [tab, setTab] = useState<EmbedTab>((s.embedDefaultTab as EmbedTab) || 'bracket');
  const [theme, setTheme] = useState<EmbedTheme>(s.embedTheme ?? 'auto');
  const [hideHeader, setHideHeader] = useState(false);
  const [showTabs, setShowTabs] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState('0');
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('600');
  const [variant, setVariant] = useState<'iframe' | 'script'>('iframe');

  const src = useMemo(
    () =>
      `${origin}/embed/${tournament.slug}${embedQueryString({
        tab,
        theme,
        hideHeader,
        showTabs,
        autoRefresh: Number(autoRefresh) || 0,
      })}`,
    [origin, tournament.slug, tab, theme, hideHeader, showTabs, autoRefresh],
  );

  const w = /^\d+$/.test(width) ? `${width}px` : width;
  const iframeCode = `<iframe src="${src}" width="${w}" height="${height}" style="border:0;max-width:100%;border-radius:12px" loading="lazy" allowfullscreen title="${tournament.name} — Bracket"></iframe>`;
  const scriptCode = `<div class="bracket-embed" data-slug="${tournament.slug}" data-tab="${tab}" data-theme="${theme}"${hideHeader ? ' data-hide-header="1"' : ''}${showTabs ? ' data-show-tabs="1"' : ''}${Number(autoRefresh) ? ` data-auto-refresh="${autoRefresh}"` : ''} style="width:${w}"></div>\n<script async src="${origin}/embed.js"></script>`;
  const code = variant === 'iframe' ? iframeCode : scriptCode;

  return (
    <Section
      title="Embed on your website"
      description="Paste the snippet into any HTML page. The script variant auto-resizes the iframe to fit its content."
    >
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div>
            <Label>Default tab</Label>
            <select className="field-select w-full" value={tab} onChange={(e) => setTab(e.target.value as EmbedTab)}>
              {EMBED_TABS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Theme</Label>
            <div className="flex gap-2">
              {EMBED_THEMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`choice-btn flex-1 capitalize ${theme === t ? 'ring-2 ring-[var(--color-accent)]' : ''}`}
                  onClick={() => setTheme(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Toggle checked={showTabs} onChange={setShowTabs} label="Show tab navigation" description="Let viewers switch between bracket, standings, matches…" />
          <Toggle checked={hideHeader} onChange={setHideHeader} label="Hide tournament header" description="Only show the content — no name/logo strip." />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Width</Label>
              <Input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="100%" />
            </div>
            <div>
              <Label>Height</Label>
              <Input value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <Label>Refresh (s)</Label>
              <Input value={autoRefresh} onChange={(e) => setAutoRefresh(e.target.value.replace(/\D/g, ''))} placeholder="0" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className={`choice-btn flex-1 ${variant === 'iframe' ? 'ring-2 ring-[var(--color-accent)]' : ''}`} onClick={() => setVariant('iframe')}>
              &lt;iframe&gt;
            </button>
            <button type="button" className={`choice-btn flex-1 ${variant === 'script' ? 'ring-2 ring-[var(--color-accent)]' : ''}`} onClick={() => setVariant('script')}>
              &lt;script&gt; (auto-height)
            </button>
          </div>
          <textarea readOnly value={code} rows={6} className="field-textarea w-full font-mono text-[11px]" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex gap-2">
            <CopyButton value={code} label="Copy code" />
            <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-[var(--color-accent)] hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Open embed
            </a>
          </div>
        </div>
        <div>
          <Label>Live preview</Label>
          <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            <iframe key={src} src={src} title="Embed preview" className="w-full" style={{ height: `${Math.min(900, Math.max(240, Number(height) || 600))}px`, border: 0 }} />
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function ImportSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState('');
  const [mode, setMode] = useState<'replace' | 'append'>('append');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const locked = (tournament.matches?.length ?? 0) > 0;

  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      api<{ ok: boolean; preview?: ImportPreview; created?: number; skipped?: number; replaced?: number }>(
        `/tournaments/${tournament.id}/import/participants`,
        { method: 'POST', token, body: JSON.stringify({ csv, mode, dryRun }) },
      ),
    onSuccess: async (res, dryRun) => {
      if (dryRun) {
        setPreview(res.preview ?? null);
        if (res.preview?.errors.length) toast.error(`${res.preview.errors.length} issue(s) found — fix before importing`);
        else toast.success(`Looks good: ${res.preview?.willCreate ?? 0} participant(s) ready`);
        return;
      }
      toast.success(`Imported ${res.created ?? 0} participant(s)${res.skipped ? `, skipped ${res.skipped} duplicate(s)` : ''}`);
      setPreview(null);
      setCsv('');
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File | null) {
    if (!file) return;
    setCsv(await file.text());
    setPreview(null);
  }

  return (
    <Section
      title="Import participants from CSV"
      description={
        <>
          Columns are auto-detected: <code>name</code>, <code>seed</code>, <code>group</code>, <code>players</code> (semicolon-separated), <code>logoUrl</code>, <code>email</code>.{' '}
          <a className="text-[var(--color-accent)] hover:underline" href={`${API_URL}/tournaments/import/template.csv`}>Download template</a>.
        </>
      }
    >
      {locked && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          The bracket is already generated — reset it (Advanced) before importing participants.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <textarea
          className="field-textarea w-full font-mono text-xs"
          rows={6}
          placeholder={'name,seed,group,players\nTeam Alpha,1,A,"Alice;Bob"'}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
        />
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-line)] px-3 py-2 text-xs hover:border-[var(--color-accent)]/50">
            <Upload className="h-3.5 w-3.5" /> Choose .csv file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
          <select className="field-select w-full" value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'append')}>
            <option value="append">Append to existing participants</option>
            <option value="replace">Replace all participants</option>
          </select>
          <Button type="button" variant="secondary" className="w-full" disabled={!csv.trim() || run.isPending} onClick={() => run.mutate(true)}>
            Preview
          </Button>
          <Button type="button" className="w-full" disabled={!preview || preview.errors.length > 0 || run.isPending || locked} onClick={() => run.mutate(false)}>
            Import {preview ? `${preview.willCreate}` : ''}
          </Button>
        </div>
      </div>
      {preview && (
        <div className="space-y-2 text-xs">
          {preview.errors.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-red-600">
              {preview.errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e.line ? `Line ${e.line}: ` : ''}{e.message}</li>
              ))}
            </ul>
          )}
          {preview.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-amber-700">
              {preview.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="overflow-x-auto rounded-lg border border-[var(--color-line)]">
            <table className="w-full text-left">
              <thead className="bg-[var(--color-surface)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2">Seed</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Players</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 12).map((r, i) => (
                  <tr key={i} className="border-t border-[var(--color-line)]">
                    <td className="px-3 py-1.5">{r.seed ?? '—'}</td>
                    <td className="px-3 py-1.5 font-medium">{r.name}</td>
                    <td className="px-3 py-1.5">{r.group ?? '—'}</td>
                    <td className="px-3 py-1.5 text-[var(--color-muted)]">{r.players.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 12 && (
              <p className="px-3 py-2 text-[var(--color-muted)]">…and {preview.rows.length - 12} more</p>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

function PasswordSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const qc = useQueryClient();
  const s = settingsOf(tournament);
  const enabled = !!s.viewPasswordEnabled;
  const [password, setPassword] = useState('');

  const setPw = useMutation({
    mutationFn: (pw: string | null) =>
      api<{ ok: boolean; enabled: boolean }>(`/tournaments/${tournament.id}/view-password`, {
        method: 'POST',
        token,
        body: JSON.stringify({ password: pw }),
      }),
    onSuccess: async (res) => {
      toast.success(res.enabled ? 'Password protection enabled' : 'Password protection disabled');
      setPassword('');
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      title="Password protection"
      description="Spectators must enter a password to view this tournament. You and your admins are never asked."
    >
      <div className={`flex items-center gap-2 text-sm ${enabled ? 'text-emerald-600' : 'text-[var(--color-muted)]'}`}>
        <Lock className="h-4 w-4" /> {enabled ? 'Enabled — viewers need the password' : 'Disabled — anyone with the link can view'}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          type="text"
          placeholder={enabled ? 'New password (min 4 chars)' : 'Choose a password (min 4 chars)'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="max-w-xs"
        />
        <Button type="button" disabled={password.trim().length < 4 || setPw.isPending} onClick={() => setPw.mutate(password.trim())}>
          {enabled ? 'Change password' : 'Enable'}
        </Button>
        {enabled && (
          <Button type="button" variant="secondary" disabled={setPw.isPending} onClick={() => setPw.mutate(null)}>
            Disable
          </Button>
        )}
      </div>
      <p className="text-[11px] text-[var(--color-muted)]">
        Applies to the public page, embeds, TV display, print and public exports. Unlocks last 7 days per device.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function ParticipantAccessSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const [links, setLinks] = useState<{ teamId: string; teamName: string; url: string | null }[] | null>(null);

  const generate = useMutation({
    mutationFn: () =>
      api<{ teamId: string; teamName: string; url: string | null }[]>(`/tournaments/${tournament.id}/teams/access-links`, {
        method: 'POST',
        token,
      }),
    onSuccess: (rows) => {
      setLinks(rows);
      toast.success(`Generated ${rows.length} access link(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      title="Participant access pages"
      description="Each team gets a private link (/p/…) showing their next match, schedule and standing. Hand out as QR cards."
    >
      <Toggle
        checked={s.participantAccessPages !== false}
        onChange={(v) => save.mutate({ participantAccessPages: v })}
        label="Enable participant access pages"
        description="Turn off to disable all participant links instantly."
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={generate.isPending || !tournament.teams.length} onClick={() => generate.mutate()} className="gap-1.5">
          <Users className="h-4 w-4" /> Generate all access links
        </Button>
        <a
          href={managerDownloadHref(`/tournaments/${tournament.id}/export/participant-qr.pdf`, token)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-accent)]/40"
        >
          <QrCode className="h-4 w-4" /> Download QR sheet (PDF)
        </a>
      </div>
      <p className="text-[11px] text-[var(--color-muted)]">
        Generating (or downloading the QR sheet) issues fresh links and invalidates previously shared ones.
      </p>
      {links && (
        <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
          {links.map((l) => (
            <li key={l.teamId} className="flex items-center justify-between gap-2 rounded border border-[var(--color-line)] px-2 py-1.5">
              <span className="truncate font-medium">{l.teamName}</span>
              {l.url ? (
                <span className="flex items-center gap-1">
                  <a href={l.url} target="_blank" rel="noreferrer" className="max-w-[220px] truncate font-mono text-[var(--color-accent)]">{l.url}</a>
                  <CopyButton value={l.url} label="" className="px-2 py-1" />
                </span>
              ) : (
                <span className="text-[var(--color-muted)]">existing link kept</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

function SeoSection({ tournament, token }: { tournament: Tournament; token?: string }) {
  const s = settingsOf(tournament);
  const save = useSaveSettings(tournament, token);
  const [exclude, setExclude] = useState(!!s.excludeFromSearchEngines);
  const [browsable, setBrowsable] = useState(s.browsableInIndex !== false);
  useEffect(() => {
    setExclude(!!s.excludeFromSearchEngines);
    setBrowsable(s.browsableInIndex !== false);
  }, [s.excludeFromSearchEngines, s.browsableInIndex]);

  return (
    <Section
      title="Discovery & search engines"
      description="Control whether this tournament appears in Bracket's public directory and in Google."
      actions={
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={() => save.mutate({ excludeFromSearchEngines: exclude, browsableInIndex: browsable })}
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Toggle
          checked={browsable}
          onChange={setBrowsable}
          label="List in Browse & Search"
          description="Show this tournament on /browse and /search (public tournaments only)."
        />
        <Toggle
          checked={exclude}
          onChange={setExclude}
          label="Exclude from search engines"
          description="Adds noindex so Google and others do not index the page."
        />
      </div>
      <p className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
        <Link2 className="h-3 w-3" /> Public URL: {webOrigin()}/t/{tournament.slug}
      </p>
    </Section>
  );
}
