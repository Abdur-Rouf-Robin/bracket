import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { Skeleton } from './skeleton';

export type Column<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  hideBelow?: 'sm' | 'md' | 'lg';
};

const HIDE_CLASS: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = 'Nothing to show yet.',
  className,
  dense = false,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: ReactNode;
  className?: string;
  dense?: boolean;
  onRowClick?: (row: T) => void;
}) {
  const pad = dense ? 'px-3 py-2' : 'px-4 py-3';
  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn(
                    pad,
                    'font-semibold',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    c.hideBelow && HIDE_CLASS[c.hideBelow],
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((c) => (
                    <td key={c.id} className={cn(pad, c.hideBelow && HIDE_CLASS[c.hideBelow])}>
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-[var(--color-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition hover:bg-[var(--color-surface)]',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        pad,
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                        c.hideBelow && HIDE_CLASS[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
