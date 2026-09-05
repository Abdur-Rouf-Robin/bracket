'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { FORMAT_META, formatVenue, type TournamentFormat } from '@bracket/shared';
import {
  CalendarDays,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Facebook,
  Gamepad2,
  Gift,
  MapPin,
  MessageCircle,
  MonitorPlay,
  Printer,
  QrCode,
  Radio,
  Settings2,
  Share2,
  Trophy,
  Twitter,
  UserCheck,
  UserPlus,
  Users,
  Users2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, tournamentStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Tournament } from '@/lib/types';
import { cn } from '@/lib/utils';

type HeroSettings = {
  registrationMode?: string;
  tentative?: boolean;
  sponsors?: { name: string; logoUrl?: string | null; url?: string | null }[];
  streamUrl?: string | null;
  prizePool?: string | null;
  hideBranding?: boolean;
};

export function tournamentFormatLabel(format: string | null | undefined): string | null {
  if (!format) return null;
  return FORMAT_META[format as TournamentFormat]?.label ?? format.replaceAll('_', ' ').toLowerCase();
}

export function formatStartAt(iso: string | null | undefined, timeZone?: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || undefined,
      timeZoneName: timeZone ? 'short' : undefined,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function Chip({ icon: Icon, children, href }: { icon: React.ComponentType<{ className?: string }>; children: ReactNode; href?: string }) {
  const cls =
    'inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-sm';
  const inner = (
    <>
      <Icon className="size-3.5 shrink-0 opacity-80" />
      <span className="truncate">{children}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cn(cls, 'hover:bg-black/40 hover:text-white')}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Could not copy to clipboard');
  }
}

export function ShareMenu({
  tournament,
  canManage,
  trigger,
}: {
  tournament: Pick<Tournament, 'slug' | 'name'>;
  canManage?: boolean;
  trigger?: ReactNode;
}) {
  const url = () => `${window.location.origin}/t/${tournament.slug}`;
  const embed = () =>
    `<iframe src="${window.location.origin}/t/${tournament.slug}/embed" width="100%" height="480" frameborder="0" title="${tournament.name}"></iframe>`;
  const text = encodeURIComponent(`${tournament.name} — live bracket & results`);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" size="sm">
            <Share2 /> Share
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Share tournament</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => copyText(url(), 'Link copied')}>
          <Copy /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/t/${tournament.slug}/qr`}>
            <QrCode /> QR code
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copyText(embed(), 'Embed code copied')}>
          <Code2 /> Copy embed code
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem asChild>
            <Link href={`/t/${tournament.slug}/manage?tab=settings&sub=sharing`}>
              <Settings2 /> Embed & sharing settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/t/${tournament.slug}/print`}>
            <Printer /> Print
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/t/${tournament.slug}/tv`}>
            <MonitorPlay /> TV display
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(typeof window !== 'undefined' ? url() : '')}`} target="_blank" rel="noreferrer">
            <Twitter /> Share on X
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? url() : '')}`} target="_blank" rel="noreferrer">
            <Facebook /> Share on Facebook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`https://wa.me/?text=${text}%20${encodeURIComponent(typeof window !== 'undefined' ? url() : '')}`} target="_blank" rel="noreferrer">
            <MessageCircle /> Share on WhatsApp
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TournamentHero({
  tournament,
  mode,
  connected,
  registrationOpen,
  canCheckIn,
  onCheckIn,
  actions,
  className,
}: {
  tournament: Tournament;
  mode: 'public' | 'manage';
  /** Realtime socket state — shows the live dot. */
  connected?: boolean;
  registrationOpen?: boolean;
  /** Viewer is a participant who can self check-in. */
  canCheckIn?: boolean;
  onCheckIn?: () => Promise<void> | void;
  /** Extra buttons appended to the action bar (e.g. manage-page controls). */
  actions?: ReactNode;
  className?: string;
}) {
  const t = tournament;
  const s = (t.settings ?? {}) as HeroSettings;
  const [checking, setChecking] = useState(false);

  const status = tournamentStatusBadge({
    status: t.status,
    registrationOpen,
    hasMatches: (t.matches?.length ?? t._count?.matches ?? 0) > 0,
  });
  const participants = t.teams?.length ?? t._count?.teams ?? 0;
  const fmt = tournamentFormatLabel(t.format);
  const when = formatStartAt(t.startAt, t.timezone);
  const venue = formatVenue(t);
  const sponsors = (s.sponsors ?? []).filter((x) => x?.name);

  return (
    <header
      className={cn(
        'relative isolate overflow-hidden rounded-2xl border border-[var(--color-line)] text-white shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="absolute inset-0 -z-10 bg-[var(--color-hero-card)]" aria-hidden />
      {t.backgroundImageUrl ? (
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: `url(${t.backgroundImageUrl})` }}
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              'radial-gradient(60% 80% at 15% 20%, color-mix(in oklab, var(--color-accent) 55%, transparent) 0%, transparent 60%), radial-gradient(50% 70% at 90% 80%, color-mix(in oklab, var(--color-accent-deep) 60%, transparent) 0%, transparent 60%)',
          }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/55 to-black/25" aria-hidden />

      <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur sm:size-20">
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <Trophy className="size-7 text-white/80" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status.variant} live={status.live}>
                {status.label}
              </Badge>
              {mode === 'manage' && <Badge variant="neutral">Manage</Badge>}
              {s.tentative && <Badge variant="warning">Tentative schedule</Badge>}
              {t.isPublic === false && <Badge variant="neutral">Private</Badge>}
              {connected !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide',
                    connected ? 'text-[var(--color-ok)]' : 'text-white/60',
                  )}
                  aria-live="polite"
                >
                  <span className={cn('relative inline-block size-1.5 rounded-full bg-current', connected && 'live-dot')} aria-hidden />
                  {connected ? 'Live updates' : 'Offline'}
                </span>
              )}
            </div>
            <h1 className="font-display mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              {t.name}
            </h1>
            {t.description && mode === 'public' && (
              <p className="mt-2 max-w-2xl text-sm text-white/80 line-clamp-2">{t.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.game?.name && <Chip icon={Gamepad2}>{t.game.name}</Chip>}
              {fmt && <Chip icon={Trophy}><span className="capitalize">{fmt}</span></Chip>}
              <Chip icon={Users}>
                {participants} {participants === 1 ? 'participant' : 'participants'}
              </Chip>
              {when && <Chip icon={CalendarDays}>{when}</Chip>}
              {venue && <Chip icon={MapPin}>{venue}</Chip>}
              {s.prizePool && <Chip icon={Gift}>{s.prizePool}</Chip>}
              {t.community && (
                <Chip icon={Users2} href={`/c/${t.community.slug}`}>
                  {t.community.name}
                </Chip>
              )}
              {t.event && (
                <Chip icon={CalendarDays} href={`/e/${t.event.slug}`}>
                  {t.event.name}
                </Chip>
              )}
            </div>
            {sponsors.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Sponsors</span>
                {sponsors.map((sp) => {
                  const inner = sp.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sp.logoUrl} alt={sp.name} className="h-6 max-w-24 object-contain" />
                  ) : (
                    <span className="text-xs font-semibold">{sp.name}</span>
                  );
                  const cls = 'inline-flex items-center rounded-md bg-white/90 px-2 py-1 text-[#0a0c10]';
                  return sp.url ? (
                    <a key={sp.name} href={sp.url} target="_blank" rel="noreferrer sponsored" className={cls} title={sp.name}>
                      {inner}
                    </a>
                  ) : (
                    <span key={sp.name} className={cls} title={sp.name}>
                      {inner}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {registrationOpen && mode === 'public' && (
            <Button size="sm" asChild className="gaming-glow">
              <Link href={`/t/${t.slug}/register`}>
                <UserPlus /> Register
              </Link>
            </Button>
          )}
          {canCheckIn && onCheckIn && (
            <Button
              size="sm"
              variant="secondary"
              loading={checking}
              onClick={async () => {
                setChecking(true);
                try {
                  await onCheckIn();
                  toast.success('You are checked in');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Check-in failed');
                } finally {
                  setChecking(false);
                }
              }}
            >
              <UserCheck /> Check in
            </Button>
          )}
          {s.streamUrl && (
            <Button size="sm" variant="outline" asChild className="border-white/25 text-white hover:bg-white/10">
              <a href={s.streamUrl} target="_blank" rel="noreferrer">
                <Radio /> Watch stream
              </a>
            </Button>
          )}
          <ShareMenu
            tournament={t}
            canManage={!!t.canManage}
            trigger={
              <Button size="sm" variant="outline" className="border-white/25 text-white hover:bg-white/10">
                <Share2 /> Share
              </Button>
            }
          />
          {t.community && mode === 'public' && (
            <Button size="sm" variant="outline" asChild className="border-white/25 text-white hover:bg-white/10">
              <Link href={`/c/${t.community.slug}`}>
                <Users2 /> Community
              </Link>
            </Button>
          )}
          {mode === 'public' && t.canManage && (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/t/${t.slug}/manage`}>
                <Settings2 /> Manage
              </Link>
            </Button>
          )}
          {mode === 'manage' && (
            <Button size="sm" variant="outline" asChild className="border-white/25 text-white hover:bg-white/10">
              <Link href={`/t/${t.slug}`}>
                <ExternalLink /> Public page
              </Link>
            </Button>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------- */
/* Manage-page status stepper                                                 */
/* ------------------------------------------------------------------------- */

export type TournamentStage = 'setup' | 'registration' | 'live' | 'completed';

export function tournamentStage(t: Tournament, registrationOpen: boolean): TournamentStage {
  if (t.status === 'COMPLETED') return 'completed';
  const teams = t.teams?.length ?? t._count?.teams ?? 0;
  const matches = t.matches?.length ?? t._count?.matches ?? 0;
  if (matches > 0 || t.status === 'ACTIVE') return 'live';
  if (registrationOpen || teams > 0) return 'registration';
  return 'setup';
}

const STAGES: { id: TournamentStage; label: string; hint: string }[] = [
  { id: 'setup', label: 'Setup', hint: 'Format, rules & venue' },
  { id: 'registration', label: 'Participants', hint: 'Add or accept sign-ups' },
  { id: 'live', label: 'Live', hint: 'Enter results as they happen' },
  { id: 'completed', label: 'Completed', hint: 'Final standings published' },
];

export function TournamentStageStepper({
  tournament,
  registrationOpen,
  onGenerate,
  onComplete,
  onReopen,
  busy,
  className,
}: {
  tournament: Tournament;
  registrationOpen: boolean;
  onGenerate: () => void;
  onComplete: () => void;
  onReopen: () => void;
  busy?: boolean;
  className?: string;
}) {
  const t = tournament;
  const stage = tournamentStage(t, registrationOpen);
  const idx = STAGES.findIndex((s) => s.id === stage);
  const teams = t.teams?.length ?? t._count?.teams ?? 0;
  const matches = t.matches?.length ?? t._count?.matches ?? 0;
  const base = `/t/${t.slug}/manage`;
  const pendingMatches = (t.matches ?? []).filter((m) => m.status !== 'COMPLETED' && !m.isBye).length;

  let primary: ReactNode;
  let helper: string;
  if (stage === 'completed') {
    helper = 'This tournament is finished. Reopen it to correct results.';
    primary = (
      <Button size="sm" variant="outline" onClick={onReopen} loading={busy}>
        Reopen
      </Button>
    );
  } else if (teams === 0) {
    helper = 'Start by adding participants — paste a list or open sign-ups.';
    primary = (
      <Button size="sm" asChild>
        <Link href={`${base}?tab=teams&sub=participants`}>
          <UserPlus /> Add participants
        </Link>
      </Button>
    );
  } else if (matches === 0) {
    helper = `${teams} participants ready. Generate the bracket or schedule to go live.`;
    primary = (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onGenerate} loading={busy}>
          <Trophy /> Generate bracket
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`${base}?tab=settings&sub=tournament`}>Format settings</Link>
        </Button>
      </div>
    );
  } else if (pendingMatches > 0) {
    helper = `${pendingMatches} ${pendingMatches === 1 ? 'match' : 'matches'} still to play.`;
    primary = (
      <Button size="sm" asChild>
        <Link href={`${base}?tab=matches&sub=play`}>
          <Radio /> Enter results
        </Link>
      </Button>
    );
  } else {
    helper = 'All matches are decided. Finalize to publish the final standings.';
    primary = (
      <Button size="sm" onClick={onComplete} loading={busy}>
        <CheckCircle2 /> Finalize tournament
      </Button>
    );
  }

  return (
    <section
      aria-label="Tournament progress"
      className={cn('card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between', className)}
    >
      <ol className="flex flex-1 items-center gap-2 overflow-x-auto" aria-label="Stages">
        {STAGES.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s.id} className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  'inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold ring-1',
                  done && 'bg-[var(--color-ok)] text-[#04120a] ring-[var(--color-ok)]',
                  active && 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] ring-[var(--color-accent)]',
                  !done && !active && 'bg-[var(--color-surface)] text-[var(--color-muted)] ring-[var(--color-line)]',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <CheckCircle2 className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="hidden flex-col sm:flex">
                <span className={cn('text-xs font-semibold', !active && !done && 'text-[var(--color-muted)]')}>{s.label}</span>
                {active && <span className="text-[10px] text-[var(--color-muted)]">{s.hint}</span>}
              </span>
              <span className="sm:hidden text-xs font-semibold">{active ? s.label : ''}</span>
              {i < STAGES.length - 1 && (
                <span className={cn('mx-1 h-px w-6 sm:w-10', done ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-line)]')} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="text-xs text-[var(--color-muted)] lg:max-w-xs lg:text-right">{helper}</p>
        {primary}
      </div>
    </section>
  );
}