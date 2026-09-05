import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms that govern your use of Bracket.',
};

const UPDATED = 'September 1, 2026';

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="container-narrow py-16">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">Legal</p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-tight">Terms of service</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Last updated {UPDATED}</p>

        <div className="prose-brand mt-10">
          <p>
            These Terms of Service (“Terms”) govern your access to and use of Bracket, including our website, applications and APIs (the “Service”). By using the Service you agree to these Terms. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization.
          </p>

          <h2>1. Accounts</h2>
          <p>You must be at least 13 years old (or the minimum age in your country) to create an account. You are responsible for keeping your credentials secure and for all activity under your account. Notify us immediately of any unauthorized use.</p>

          <h2>2. Your content</h2>
          <p>You retain ownership of the tournaments, names, images and other content you upload (“Content”). You grant us a worldwide, non-exclusive licence to host, display and distribute Content as needed to operate the Service, including on public tournament pages and embeds you enable. You are responsible for having the rights to any Content you upload and for the accuracy of participant information.</p>

          <h2>3. Acceptable use</h2>
          <ul>
            <li>Do not upload unlawful, harassing, defamatory or infringing content.</li>
            <li>Do not attempt to access other users’ private data or disrupt the Service.</li>
            <li>Do not use automated means beyond the documented API and its rate limits.</li>
            <li>Do not use the Service for gambling or wagering where prohibited.</li>
          </ul>

          <h2>4. Plans, payments and refunds</h2>
          <p>The platform is free. There is no organizer subscription. Entry fees and ticket sales, if you choose to collect them, are processed through your own connected payment account and are subject to the processor’s terms.</p>

          <h2>5. Availability and changes</h2>
          <p>We aim for high availability but the Service is provided “as is” without warranties of any kind. We may modify or discontinue features with reasonable notice. We may suspend accounts that violate these Terms.</p>

          <h2>6. Limitation of liability</h2>
          <p>To the maximum extent permitted by law, Bracket and its team will not be liable for indirect, incidental or consequential damages, or for any loss of data, revenue or profits arising from your use of the Service. Our total liability is limited to the amount you paid us in the twelve months before the claim.</p>

          <h2>7. Termination</h2>
          <p>You may delete your account at any time from Settings. We may terminate or suspend access for breach of these Terms. Sections that by their nature should survive termination will survive.</p>

          <h2>8. Changes to these Terms</h2>
          <p>We may update these Terms. Material changes will be announced in the app or by email at least 14 days before they take effect. Continued use after that date constitutes acceptance.</p>

          <h2>9. Contact</h2>
          <p>
            Questions about these Terms? <Link href="/contact">Contact us</Link>. See also our <Link href="/privacy">Privacy policy</Link>.
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
