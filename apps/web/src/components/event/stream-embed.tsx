'use client';

import { useMemo } from 'react';
import { ExternalLink, Radio } from 'lucide-react';
import { streamProvider, toStreamEmbedUrl } from '@bracket/shared';
import { cn } from '@/lib/utils';

/**
 * Renders a 16:9 iframe for a YouTube/Twitch stream. Pass `embedUrl` from the
 * API when available; otherwise it is derived client-side from `url`.
 */
export function StreamEmbed({
  url,
  embedUrl,
  title = 'Live stream',
  className,
}: {
  url?: string | null;
  embedUrl?: string | null;
  title?: string;
  className?: string;
}) {
  const src = useMemo(() => {
    if (embedUrl) return embedUrl;
    const parentHost =
      typeof window !== 'undefined' ? window.location.hostname : undefined;
    return toStreamEmbedUrl(url, { parentHost });
  }, [url, embedUrl]);
  const provider = streamProvider(url);

  if (!src) {
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'panel-card flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm hover:border-[var(--color-accent)]/50',
          className,
        )}
      >
        <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
          <Radio className="size-4 text-[var(--color-accent)]" /> Watch the stream
        </span>
        <ExternalLink className="size-4 text-[var(--color-muted)]" />
      </a>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-[var(--color-line)] bg-black', className)}>
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      {url && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--color-muted)]">
          <span className="capitalize">{provider ?? 'Stream'}</span>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]">
            Open <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </div>
  );
}
