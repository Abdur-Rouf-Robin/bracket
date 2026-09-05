'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CopyField } from '@/components/sharing/panel-kit';

/** One-time secret banner — the value is never stored after dismiss. */
export function SecretReveal({
  title,
  value,
  hint,
  onDismiss,
}: {
  title: string;
  value: string;
  hint?: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{title}</p>
      <CopyField value={value} />
      {hint && <div className="text-xs text-[var(--color-muted)]">{hint}</div>}
      <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
        I copied it
      </Button>
    </div>
  );
}
