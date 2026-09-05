import { cn } from '@/lib/utils';
import type { CommunityRole } from '@/lib/types-platform';

const STYLES: Record<CommunityRole, string> = {
  OWNER: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  ADMIN: 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  COLLABORATOR: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
  AFFILIATE: 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]',
};

const LABELS: Record<CommunityRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  COLLABORATOR: 'Collaborator',
  AFFILIATE: 'Affiliate',
};

export function roleLabel(role: CommunityRole): string {
  return LABELS[role];
}

export function RoleBadge({
  role,
  className,
}: {
  role: CommunityRole | null | undefined;
  className?: string;
}) {
  if (!role) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        STYLES[role],
        className,
      )}
    >
      {LABELS[role]}
    </span>
  );
}
