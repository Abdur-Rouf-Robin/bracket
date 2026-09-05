'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

export function initialsOf(name?: string | null, fallback = '?'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const PALETTE = [
  'from-sky-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-fuchsia-500 to-purple-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-500',
];

function paletteFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  square = false,
}: {
  name?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  square?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass =
    size === 'xs'
      ? 'size-6 text-[10px]'
      : size === 'sm'
        ? 'size-8 text-xs'
        : size === 'lg'
          ? 'size-12 text-base'
          : size === 'xl'
            ? 'size-16 text-xl'
            : 'size-9 text-sm';
  const shape = square ? 'rounded-lg' : 'rounded-full';
  const showImage = src && !failed;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-bold text-white ring-1 ring-black/10',
        sizeClass,
        shape,
        !showImage && `bg-gradient-to-br ${paletteFor(name ?? '')}`,
        className,
      )}
      aria-label={name ?? undefined}
      role="img"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? ''}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
