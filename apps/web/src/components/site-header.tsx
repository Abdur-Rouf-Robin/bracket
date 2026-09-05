'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Code2,
  Compass,
  CreditCard,
  Goal,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogTitle,
  SheetContent,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/inbox/notification-bell';
import { MustChangePasswordBanner } from '@/components/account/must-change-password-banner';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

type NavLink = { label: string; href: string; description?: string; icon?: ReactNode };
type NavGroup = { label: string; items: NavLink[] };

export const CREATE_LINKS: NavLink[] = [
  { label: 'Tournament', href: '/tournaments/new', description: 'Brackets, groups, Swiss & more', icon: <Trophy className="size-4" /> },
  { label: 'Community', href: '/communities/new', description: 'Your club, league or org', icon: <Users className="size-4" /> },
  { label: 'Event', href: '/events/new', description: 'Multi-tournament events & tickets', icon: <CalendarDays className="size-4" /> },
  { label: 'Quick bracket', href: '/bracket-generator', description: 'No account needed', icon: <Zap className="size-4" /> },
  { label: 'Cricket scoreboard', href: '/sports/cricket/free/new', description: 'Ball-by-ball, no tournament needed', icon: <ClipboardList className="size-4" /> },
];

export const DISCOVER_LINKS: NavLink[] = [
  { label: 'Browse tournaments', href: '/browse', icon: <Compass className="size-4" /> },
  { label: 'Search', href: '/search', icon: <Search className="size-4" /> },
  { label: 'Communities', href: '/communities', icon: <Users className="size-4" /> },
  { label: 'Events', href: '/events', icon: <CalendarDays className="size-4" /> },
  { label: 'Cricket', href: '/sports/cricket', icon: <CircleDot className="size-4" /> },
];

export const SPORTS_LINKS: NavLink[] = [
  { label: 'Cricket scoreboard', href: '/sports/cricket/free/new', description: 'Start a free live board', icon: <ClipboardList className="size-4" /> },
  { label: 'Cricket hub', href: '/sports/cricket', description: 'T20, ODI, Test & The Hundred', icon: <CircleDot className="size-4" /> },
  { label: 'Football', href: '/sports/football', description: 'Goals, ET and penalties', icon: <Goal className="size-4" /> },
];

export const FORMAT_LINKS: NavLink[] = [
  { label: 'Single elimination', href: '/formats/single-elimination' },
  { label: 'Double elimination', href: '/formats/double-elimination' },
  { label: 'Round robin', href: '/formats/round-robin' },
  { label: 'Swiss', href: '/formats/swiss' },
  { label: 'Groups + knockout', href: '/formats/groups-knockout' },
  { label: 'Free for all', href: '/formats/free-for-all' },
  { label: 'Leaderboard', href: '/formats/leaderboard' },
  { label: 'Racing', href: '/formats/racing' },
];

const NAV_GROUPS: NavGroup[] = [
  { label: 'Create', items: CREATE_LINKS },
  { label: 'Discover', items: DISCOVER_LINKS },
  { label: 'Sports', items: SPORTS_LINKS },
  { label: 'Formats', items: FORMAT_LINKS },
];

const TOP_LINKS: NavLink[] = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Help', href: '/help' },
];

function NavDropdown({ group, wide }: { group: NavGroup; wide?: boolean }) {
  const pathname = usePathname() ?? '';
  const active = group.items.some((i) => pathname.startsWith(i.href));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] data-[state=open]:bg-[var(--color-surface)] data-[state=open]:text-[var(--color-ink)]',
            active ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]',
          )}
        >
          {group.label}
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn(wide ? 'grid w-[28rem] grid-cols-2 gap-0.5' : 'w-64')}>
        {group.items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className="items-start">
              {item.icon && (
                <span className="mt-0.5 text-[var(--color-accent)]">{item.icon}</span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{item.label}</span>
                {item.description && (
                  <span className="text-xs text-[var(--color-muted)]">{item.description}</span>
                )}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSearch({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  }
  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]"
        aria-hidden
      />
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search tournaments, communities…"
        aria-label="Search"
        className="h-9 w-full rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] pl-9 pr-3 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/30"
      />
    </form>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const u = user as typeof user & {
    username?: string | null;
    avatarUrl?: string | null;
    plan?: 'FREE' | 'PREMIER';
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="inline-flex items-center gap-2 rounded-full p-0.5 pr-1 transition hover:bg-[var(--color-surface)] data-[state=open]:bg-[var(--color-surface)]"
        >
          <Avatar name={u.name} src={u.avatarUrl} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={u.name} src={u.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{u.name}</p>
            <p className="truncate text-xs text-[var(--color-muted)]">{u.email}</p>
          </div>
          <Badge variant="neutral" className="ml-auto">Free</Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard"><LayoutDashboard className="size-4" /> Dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/communities?mine=1"><Users className="size-4" /> My communities</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/events?mine=1"><CalendarDays className="size-4" /> My events</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/play"><Trophy className="size-4" /> My matches</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings"><Settings className="size-4" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/billing"><CreditCard className="size-4" /> Billing</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/developer"><Code2 className="size-4" /> Developer</Link>
        </DropdownMenuItem>
        {u.role === 'ADMIN' && (
          <DropdownMenuItem asChild>
            <Link href="/admin"><Shield className="size-4" /> Admin</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => logout()}>
          <LogOut className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileDrawer({ loggedIn, isAdmin }: { loggedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { logout } = useAuth();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const section = (title: string, items: NavLink[]) => (
    <div>
      <p className="menu-label px-1">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
            >
              {i.icon && <span className="text-[var(--color-accent)]">{i.icon}</span>}
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        className="lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      <SheetContent aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <DialogTitle className="font-display text-base font-bold">Menu</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Close</Button>
          </DialogClose>
        </div>
        <div className="space-y-5 p-4">
          <GlobalSearch />
          {!loggedIn && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" asChild><Link href="/login">Sign in</Link></Button>
              <Button asChild><Link href="/register">Get started</Link></Button>
            </div>
          )}
          {loggedIn &&
            section('Account', [
              { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="size-4" /> },
              { label: 'My communities', href: '/communities?mine=1', icon: <Users className="size-4" /> },
              { label: 'My events', href: '/events?mine=1', icon: <CalendarDays className="size-4" /> },
              { label: 'My matches', href: '/play', icon: <Trophy className="size-4" /> },
              { label: 'Notifications', href: '/inbox', icon: <Sparkles className="size-4" /> },
              { label: 'Settings', href: '/settings', icon: <Settings className="size-4" /> },
              { label: 'Billing', href: '/settings/billing', icon: <CreditCard className="size-4" /> },
              { label: 'Developer', href: '/developer', icon: <Code2 className="size-4" /> },
              ...(isAdmin ? [{ label: 'Admin', href: '/admin', icon: <Shield className="size-4" /> }] : []),
            ])}
          {section('Create', CREATE_LINKS)}
          {section('Discover', DISCOVER_LINKS)}
          {section('Sports', SPORTS_LINKS)}
          {section('Formats', FORMAT_LINKS)}
          {section('More', [
            { label: 'Features', href: '/features', icon: <Sparkles className="size-4" /> },
            { label: 'Pricing', href: '/pricing', icon: <CreditCard className="size-4" /> },
            { label: 'Help center', href: '/help', icon: <BookOpen className="size-4" /> },
            { label: 'About', href: '/about', icon: <Building2 className="size-4" /> },
          ])}
          <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-4">
            <span className="text-sm text-[var(--color-muted)]">Theme</span>
            <ThemeToggle />
          </div>
          {loggedIn && (
            <Button variant="outline" className="w-full" onClick={() => { setOpen(false); logout(); }}>
              <LogOut /> Log out
            </Button>
          )}
        </div>
      </SheetContent>
    </Dialog>
  );
}

export function SiteHeader({ className }: { className?: string }) {
  const { user } = useAuth();
  const pathname = usePathname() ?? '';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showUser = mounted && !!user;

  return (
    <div className="sticky top-0 z-50">
    <header
      className={cn(
        'glass border-b border-[var(--color-line)]',
        className,
      )}
    >
      <div className="container-page flex h-16 items-center gap-2">
        <Link
          href="/"
          className="font-display mr-2 inline-flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--color-ink)]"
          aria-label="Bracket home"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-glow)] text-[var(--color-accent-fg)] shadow-sm">
            <Trophy className="size-4" aria-hidden />
          </span>
          <span>
            Bracket
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          <NavDropdown group={NAV_GROUPS[0]!} />
          <NavDropdown group={NAV_GROUPS[1]!} />
          <NavDropdown group={NAV_GROUPS[2]!} />
          <NavDropdown group={NAV_GROUPS[3]!} wide />
          {TOP_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
                  active ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <GlobalSearch className="hidden w-56 xl:block 2xl:w-72" />
          <Button variant="ghost" size="icon" aria-label="Search" className="xl:hidden" asChild>
            <Link href="/search"><Search /></Link>
          </Button>
          <ThemeToggle className="hidden sm:inline-flex" />
          {showUser ? (
            <>
              <NotificationBell />
              <Button size="sm" className="hidden md:inline-flex" asChild>
                <Link href="/tournaments/new"><Plus /> New</Link>
              </Button>
              <UserMenu />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
          <MobileDrawer loggedIn={showUser} isAdmin={user?.role === 'ADMIN'} />
        </div>
      </div>
    </header>
    <MustChangePasswordBanner />
    </div>
  );
}
