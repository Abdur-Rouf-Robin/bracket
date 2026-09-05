import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FEATURE_SECTIONS, PLANS, formatPlanPrice, planMonthlyEquivalentCents, type FeatureValue } from '@/lib/plans';
import { cn } from '@/lib/utils';

function Cell({ value, highlight }: { value: FeatureValue; highlight?: boolean }) {
  if (value === true) {
    return (
      <span className={cn('inline-flex size-6 items-center justify-center rounded-full', highlight ? 'bg-[var(--color-premier)]/15 text-[var(--color-premier)]' : 'bg-[var(--color-ok)]/15 text-[var(--color-ok)]')}>
        <Check className="size-3.5" strokeWidth={3} aria-label="Included" />
      </span>
    );
  }
  if (value === false) {
    return <Minus className="inline size-4 text-[var(--color-muted)]/60" aria-label="Not included" />;
  }
  return <span className="text-xs font-semibold">{value}</span>;
}

export function FeatureTable({ compact = false, sections = FEATURE_SECTIONS }: { compact?: boolean; sections?: typeof FEATURE_SECTIONS }) {
  const premierMonthly = formatPlanPrice(planMonthlyEquivalentCents(PLANS.PREMIER, 'year'));
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="sticky top-16 z-10 bg-[var(--color-card)]">
          <tr className="border-b border-[var(--color-line)]">
            <th scope="col" className="px-4 py-4 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Feature
            </th>
            <th scope="col" className="w-36 px-3 py-4 text-center align-bottom">
              <p className="font-display text-base font-bold">{PLANS.FREE.name}</p>
              <p className="text-xs text-[var(--color-muted)]">$0 forever</p>
              {!compact && (
                <Button size="sm" variant="secondary" className="mt-2 w-full" asChild>
                  <Link href="/register">Start free</Link>
                </Button>
              )}
            </th>
            <th scope="col" className="w-36 bg-[var(--color-premier)]/5 px-3 py-4 text-center align-bottom">
              <p className="font-display text-base font-bold text-[var(--color-premier)]">{PLANS.PREMIER.name}</p>
              <p className="text-xs text-[var(--color-muted)]">from {premierMonthly}/mo</p>
              {!compact && (
                <Button size="sm" variant="premier" className="mt-2 w-full" asChild>
                  <Link href="/pricing">Upgrade</Link>
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
          colSpan={3}
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
          <td className="px-3 py-3 text-center"><Cell value={r.standard} /></td>
          <td className="bg-[var(--color-premier)]/5 px-3 py-3 text-center"><Cell value={r.premier} highlight /></td>
        </tr>
      ))}
    </>
  );
}
