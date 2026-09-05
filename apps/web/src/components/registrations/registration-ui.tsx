'use client';

import type { ReactNode } from 'react';
import { registrationStatusLabel } from '@bracket/shared';
import type { RegistrationStatusValue } from '@bracket/shared';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<string, string> = {
  ok: 'border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 text-[var(--color-ok)]',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  info: 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  danger: 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
  muted: 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]',
};

export function Pill({
  tone = 'muted',
  children,
  className,
}: {
  tone?: 'ok' | 'warn' | 'info' | 'danger' | 'muted';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusPill({
  status,
  waitlistPosition,
}: {
  status: RegistrationStatusValue;
  waitlistPosition?: number | null;
}) {
  const { label, tone } = registrationStatusLabel(status);
  return (
    <Pill tone={tone}>
      {label}
      {status === 'WAITLISTED' && waitlistPosition ? ` #${waitlistPosition}` : ''}
    </Pill>
  );
}

export function PaymentBadge({
  status,
}: {
  status: 'FREE' | 'UNPAID' | 'PAID' | 'REFUNDED';
}) {
  switch (status) {
    case 'PAID':
      return <Pill tone="ok">Paid</Pill>;
    case 'UNPAID':
      return <Pill tone="warn">Unpaid</Pill>;
    case 'REFUNDED':
      return <Pill tone="muted">Refunded</Pill>;
    case 'FREE':
    default:
      return <Pill tone="muted">Free</Pill>;
  }
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/40 p-3 text-sm transition hover:border-[var(--color-accent)]/40',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-[var(--color-accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block font-medium">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{hint}</span>
        )}
      </span>
    </label>
  );
}

export function FieldRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-[var(--color-muted)]">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-[var(--color-line)] pb-2">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">{description}</p>
      )}
    </div>
  );
}

/** Convert an ISO string to the value expected by `<input type="datetime-local">`. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDateTime(iso: string | null | undefined, timezone?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || undefined,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}
