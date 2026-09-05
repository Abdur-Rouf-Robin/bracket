import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FEATURE_SECTIONS, type FeatureValue } from '@/lib/plans';

function Cell({ value }: { value: FeatureValue }) {
  if (value === true) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--color-ok)]/15 text-[var(--color-ok)]">
        <Check className="size-3.5" strokeWidth={3} aria-label="Included" />
      </span>
    );
  }
  return <span className="text-xs font-semibold">{value}</span>;
}

export function FeatureTable({
  compact = false,
  sections = FEATURE_SECTIONS,
}: {
  compact?: boolean;
  sections?: typeof FEATURE_SECTIONS;
}) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="sticky top-16 z-10 bg-[var(--color-card)]">
          <tr className="border-b border-[var(--color-line)]">
            <th
              scope="col"
              className="px-4 py-4 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]"
            >
              Feature
            </th>
            <th scope="col" className="w-40 px-3 py-4 text-center align-bottom">
              <p className="font-display text-base font-bold">Included</p>
              <p className="text-xs text-[var(--color-muted)]">$0 forever</p>
              {!compact && (
                <Button size="sm" variant="secondary" className="mt-2 w-full" asChild>
                  <Link href="/register">Start free</Link>
                </Button>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <SectionRows key={s.id} section={s} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionRows({ section }: { section: (typeof FEATURE_SECTIONS)[number] }) {
  return (
    <>
      <tr id={section.id} className="bg-[var(--color-surface)]/70">
        <th
          colSpan={2}
          scope="colgroup"
          className="font-display px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]"
        >
          {section.title}
        </th>
      </tr>
      {section.rows.map((r) => (
        <tr key={r.label} className="border-t border-[var(--color-line)]">
          <td className="px-4 py-3">
            <span className="font-medium">{r.label}</span>
            {r.hint && <p className="text-xs text-[var(--color-muted)]">{r.hint}</p>}
          </td>
          <td className="px-3 py-3 text-center">
            <Cell value={r.included} />
          </td>
        </tr>
      ))}
    </>
  );
}
