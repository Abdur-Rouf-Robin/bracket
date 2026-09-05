import Link from 'next/link';
import { Github, Globe, Trophy, Twitter, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Bracket generator', href: '/bracket-generator' },
      { label: 'Formats', href: '/formats/single-elimination' },
      { label: 'Cricket scoreboard', href: '/sports/cricket/free/new' },
    ],
  },
  {
    title: 'Discover',
    links: [
      { label: 'Browse tournaments', href: '/browse' },
      { label: 'Communities', href: '/communities' },
      { label: 'Events', href: '/events' },
      { label: 'Search', href: '/search' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help center', href: '/help' },
      { label: 'API docs', href: '/api-docs' },
      { label: 'Status', href: '/help/status' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Terms of service', href: '/terms' },
      { label: 'Privacy policy', href: '/privacy' },
    ],
  },
];

const LANGUAGES = [
  { code: 'en', label: 'English', enabled: true },
  { code: 'es', label: 'Español', enabled: false },
  { code: 'fr', label: 'Français', enabled: false },
  { code: 'de', label: 'Deutsch', enabled: false },
  { code: 'pt', label: 'Português', enabled: false },
  { code: 'bn', label: 'বাংলা', enabled: false },
];

export function SiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer
      className={cn(
        'no-print mt-auto border-t border-[var(--color-line)] bg-[var(--color-surface)]/40',
        className,
      )}
    >
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="font-display inline-flex items-center gap-2 text-lg font-bold">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-glow)] text-[var(--color-accent-fg)]">
                <Trophy className="size-4" aria-hidden />
              </span>
              Bracket
            </Link>
            <p className="mt-3 max-w-xs text-sm text-[var(--color-muted)]">
              Run any tournament. Brackets, schedules and live results for clubs, leagues,
              esports and everything in between.
            </p>
            <div className="mt-4 flex items-center gap-1">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Bracket on X (Twitter)"
                className="inline-flex size-9 items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              >
                <Twitter className="size-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Bracket on YouTube"
                className="inline-flex size-9 items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              >
                <Youtube className="size-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Bracket on GitHub"
                className="inline-flex size-9 items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              >
                <Github className="size-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-[var(--color-ink)]/80 transition hover:text-[var(--color-accent)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Bracket. All rights reserved.</p>
          <label className="inline-flex items-center gap-2">
            <Globe className="size-3.5" aria-hidden />
            <span className="sr-only">Language</span>
            <select
              defaultValue="en"
              aria-label="Language"
              className="h-8 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]/50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} disabled={!l.enabled}>
                  {l.label}
                  {!l.enabled ? ' (soon)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </footer>
  );
}
