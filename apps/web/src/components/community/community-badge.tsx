import Link from 'next/link';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Small "Hosted by <community>" chip for tournament/event pages. */
export function CommunityBadge({
  community,
  className,
  prefix = 'Hosted by',
}: {
  community: { slug: string; name: string; logoUrl?: string | null } | null | undefined;
  className?: string;
  prefix?: string;
}) {
  if (!community) return null;
  return (
    <Link
      href={`/c/${community.slug}`}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/40 hover:text-[var(--color-ink)]',
        className,
      )}
    >
      {community.logoUrl ? (
        <img
          src={community.logoUrl}
          alt=""
          className="size-4 rounded-full object-cover"
        />
      ) : (
        <Users className="size-3.5" />
      )}
      <span>
        {prefix} <span className="font-semibold text-[var(--color-ink)]">{community.name}</span>
      </span>
    </Link>
  );
}
