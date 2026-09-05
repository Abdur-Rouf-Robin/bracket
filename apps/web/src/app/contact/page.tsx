import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BookOpen, LifeBuoy, Mail } from 'lucide-react';
import { ContactForm } from '@/components/marketing/contact-form';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the Bracket team for support, billing, partnerships and press.',
};

export default function ContactPage() {
  return (
    <MarketingShell>
      <section className="container-page pt-16 pb-10">
        <SectionHeading eyebrow="Contact" title="Talk to a human" description="Questions, bugs, feature requests or partnership ideas — send them our way." />
      </section>
      <section className="container-page grid gap-8 pb-20 lg:grid-cols-[1fr_20rem]">
        <Suspense fallback={<div className="skeleton h-96" />}>
          <ContactForm />
        </Suspense>
        <aside className="space-y-4">
          <Link href="/help" className="card card-hover flex items-start gap-3 p-4">
            <BookOpen className="mt-0.5 size-5 text-[var(--color-accent)]" aria-hidden />
            <div>
              <p className="font-display text-sm font-bold">Help center</p>
              <p className="text-xs text-[var(--color-muted)]">Guides for every feature — the fastest way to get unstuck.</p>
            </div>
          </Link>
          <Link href="/help/status" className="card card-hover flex items-start gap-3 p-4">
            <LifeBuoy className="mt-0.5 size-5 text-[var(--color-ok)]" aria-hidden />
            <div>
              <p className="font-display text-sm font-bold">Service status</p>
              <p className="text-xs text-[var(--color-muted)]">Check for outages and planned maintenance.</p>
            </div>
          </Link>
          <div className="card flex items-start gap-3 p-4">
            <Mail className="mt-0.5 size-5 text-[var(--color-muted)]" aria-hidden />
            <div>
              <p className="font-display text-sm font-bold">Email</p>
              <p className="text-xs text-[var(--color-muted)]">{process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@bracket.app'}</p>
            </div>
          </div>
        </aside>
      </section>
    </MarketingShell>
  );
}
