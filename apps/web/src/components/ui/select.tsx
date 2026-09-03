'use client';

import { cn } from '@/lib/utils';
import { useEffect, useId, useRef, useState } from 'react';

export type SelectOption = { value: string; label: string };
export type SelectGroup = { label: string; options: SelectOption[] };

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options?: SelectOption[];
  groups?: SelectGroup[];
  className?: string;
};

function flatten(groups?: SelectGroup[], options?: SelectOption[]) {
  if (options) return options;
  return groups?.flatMap((g) => g.options) ?? [];
}

export function Select({
  value,
  onChange,
  placeholder = 'Select…',
  options,
  groups,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const flat = flatten(groups, options);
  const selected = flat.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="field-select flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={selected ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}>
          {selected?.label ?? placeholder}
        </span>
        <span
          className={cn(
            'text-[10px] text-[var(--color-muted)] transition',
            open && 'rotate-180',
          )}
        >
          ▼
        </span>
      </button>

      {open && (
        <div id={listId} role="listbox" className="dropdown-panel">
          {!selected && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="dropdown-item w-full text-left text-[var(--color-muted)]"
              onClick={() => pick('')}
            >
              {placeholder}
            </button>
          )}

          {groups?.map((group) => (
            <div key={group.label}>
              <p className="dropdown-group-label">{group.label}</p>
              {group.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  className={cn(
                    'dropdown-item w-full text-left',
                    value === opt.value && 'dropdown-item-active',
                  )}
                  onClick={() => pick(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ))}

          {options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              className={cn(
                'dropdown-item w-full text-left',
                value === opt.value && 'dropdown-item-active',
              )}
              onClick={() => pick(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
