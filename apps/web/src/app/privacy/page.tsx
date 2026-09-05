import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Bracket collects, uses and protects your data.',
};

const UPDATED = 'September 1, 2026';

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="container-narrow py-16">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">Legal</p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-tight">Privacy policy</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Last updated {UPDATED}</p>

        <div className="prose-brand mt-10">
          <p>This policy explains what information Bracket collects, how we use it, and the choices you have. We keep it short on purpose.</p>

          <h2>What we collect</h2>
          <ul>
            <li><strong>Account data</strong> — name, email, password hash, optional username, avatar, timezone and country.</li>
            <li><strong>Tournament data</strong> — participants, results, schedules, registrations and any custom fields organizers choose to collect.</li>
            <li><strong>Usage data</strong> — pages visited, device and browser type, approximate location from IP, and error logs to keep the Service reliable.</li>
            <li><strong>Payment data</strong> — handled by our payment processor. We store only a customer reference, plan and billing status, never card numbers.</li>
          </ul>

          <h2>How we use it</h2>
          <ul>
            <li>To provide the Service: publish tournament pages, send notifications, process registrations and payments.</li>
            <li>To improve the Service: aggregate analytics and error monitoring.</li>
            <li>To communicate: transactional emails (verification, results, receipts) and, if you opt in, product updates.</li>
          </ul>
          <p>We do not sell personal data. Standard plan pages may display advertising; ad partners receive only non-identifying context about the page.</p>

          <h2>Public information</h2>
          <p>Tournaments are public by default. Participant names, results and standings appear on public pages, embeds and search engines unless the organizer restricts visibility. Organizers are responsible for informing participants of this. Your public profile shows only what you choose to fill in.</p>

          <h2>Cookies</h2>
          <p>We use strictly necessary cookies for sign-in and preferences (such as theme), and privacy-friendly analytics. You can clear cookies at any time; you will be signed out.</p>

          <h2>Retention and deletion</h2>
          <p>We keep your data while your account is active. Deleting your account removes your personal data within 30 days; tournaments you own are deleted or, if shared with a community, transferred to another admin. Backups are purged on a rolling 30-day schedule.</p>

          <h2>Your rights</h2>
          <p>Depending on where you live you may have rights to access, correct, export or delete your data, and to object to certain processing. Use Settings to manage most of this yourself, or <Link href="/contact">contact us</Link>.</p>

          <h2>Security</h2>
          <p>Data is encrypted in transit and at rest. Passwords are hashed with a modern algorithm. Access to production systems is limited and logged.</p>

          <h2>Children</h2>
          <p>The Service is not directed to children under 13. Organizers running youth events should collect only the minimum information required and obtain guardian consent where applicable.</p>

          <h2>Changes</h2>
          <p>We will post updates here and notify you of material changes in the app or by email.</p>

          <h2>Contact</h2>
          <p>Privacy questions? <Link href="/contact?topic=other">Contact us</Link>.</p>
        </div>
      </article>
    </MarketingShell>
  );
}
