'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';
import type { TournamentSettings } from '@bracket/shared';
import { api, API_URL } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Public web origin (for share links). Falls back to the browser origin. */
export function webOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

export function settingsOf(t: Tournament): Partial<TournamentSettings> {
  return (t.settings ?? {}) as Partial<TournamentSettings>;
}

/** PATCH /tournaments/:id { settings } with query invalidation + toasts. */
export function useSaveSettings(tournament: Tournament, token?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<TournamentSettings>) =>
      api<Tournament>(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ settings }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
      toast.success('Settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** PATCH /tournaments/:id with top-level fields. */
export function useSaveTournament(tournament: Tournament, token?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Tournament>(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function Section({
  title,
  description,
  children,
  actions,
  className,
  id,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('panel-card space-y-4 rounded-xl p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {description && (
            <p className="mt-1 max-w-2xl text-xs text-[var(--color-muted)]">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      className={cn('gap-1.5 whitespace-nowrap', className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success('Copied to clipboard');
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error('Clipboard unavailable');
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          'w-full min-w-0 flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]',
          mono && 'font-mono text-xs',
        )}
      />
      <CopyButton value={value} />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  badge,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/40 px-4 py-3">
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          {label}
          {badge}
        </span>
        {description && <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50',
          checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}

/** Build a download href that carries the JWT as `?access_token=` for manager exports. */
export function managerDownloadHref(path: string, token?: string) {
  const sep = path.includes('?') ? '&' : '?';
  return `${API_URL}${path}${token ? `${sep}access_token=${encodeURIComponent(token)}` : ''}`;
}

export function DownloadLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/40 px-3 py-2 text-sm hover:border-[var(--color-accent)]/50',
        className,
      )}
    >
      {children}
    </a>
  );
}
