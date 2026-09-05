'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type FaqItem = { q: string; a: ReactNode };

export function Faq({
  items,
  className,
  defaultOpen = 0,
}: {
  items: FaqItem[];
  className?: string;
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className={cn('card divide-y divide-[var(--color-line)] overflow-hidden', className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `faq-${i}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-panel`}
                id={`${id}-button`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold transition hover:bg-[var(--color-surface)] md:text-base"
              >
                {item.q}
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-[var(--color-muted)] transition-transform',
                    isOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={`${id}-panel`}
              role="region"
              aria-labelledby={`${id}-button`}
              hidden={!isOpen}
              className="px-5 pb-5 text-sm leading-relaxed text-[var(--color-muted)]"
            >
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
