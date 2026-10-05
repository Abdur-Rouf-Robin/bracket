export type MainTab =
  | 'overview'
  | 'teams'
  | 'players'
  | 'bracket'
  | 'matches'
  | 'schedule'
  | 'standings'
  | 'stats'
  | 'registrations'
  | 'settings';

export type TeamsSub = 'participants' | 'rosters' | 'team-settings';
export type PlayersSub = 'all' | 'by-team' | 'performance' | 'edit';
export type BracketSub = 'full' | 'knockout';
export type ScheduleSub = 'calendar' | 'stations' | 'referees' | 'generate' | 'queue';
export type StatsSub = 'teams' | 'leaderboard' | 'knockout';
export type RegistrationsSub = 'pending' | 'approved' | 'waitlist' | 'rejected' | 'form';
export type SettingsSub =
  | 'venue'
  | 'rosters'
  | 'tournament'
  | 'standings'
  | 'registration'
  | 'branding'
  | 'sharing'
  | 'integrations'
  | 'media'
  | 'tools'
  | 'danger';

export type SubTab =
  | TeamsSub
  | PlayersSub
  | BracketSub
  | ScheduleSub
  | StatsSub
  | RegistrationsSub
  | SettingsSub;

const PUBLIC_TABS: MainTab[] = [
  'bracket',
  'teams',
  'matches',
  'standings',
  'schedule',
];

/** League-style formats open on the table. Knockouts open on the bracket. */
const LEAGUE_FORMATS = new Set([
  'ROUND_ROBIN',
  'SWISS',
  'LEADERBOARD',
  'FREE_FOR_ALL',
  'TIME_TRIAL',
  'SINGLE_RACE',
  'GRAND_PRIX',
]);

export function parseTournamentNav(
  searchParams: URLSearchParams,
  mode: 'public' | 'manage',
  opts?: { canManage?: boolean; format?: string | null; showStandings?: boolean },
): { tab: MainTab; sub: string } {
  let tab = (searchParams.get('tab') as MainTab) || defaultTab(mode, opts);
  if (mode === 'public' && !PUBLIC_TABS.includes(tab)) {
    tab = defaultTab(mode, opts);
  }
  if (mode === 'public' && tab === 'standings' && opts?.showStandings === false) {
    tab = 'bracket';
  }
  let sub = searchParams.get('sub') ?? defaultSub(tab, mode);
  if (
    tab === 'matches' &&
    !searchParams.get('sub') &&
    opts?.canManage &&
    mode === 'manage'
  ) {
    sub = 'play';
  }
  return { tab, sub };
}

function defaultTab(
  mode: 'public' | 'manage',
  opts?: { format?: string | null; showStandings?: boolean },
): MainTab {
  if (mode === 'manage') return 'matches';
  if (
    opts?.showStandings !== false &&
    opts?.format &&
    LEAGUE_FORMATS.has(opts.format)
  ) {
    return 'standings';
  }
  return 'bracket';
}

function defaultSub(tab: MainTab, mode: 'public' | 'manage'): string {
  switch (tab) {
    case 'teams':
      return 'participants';
    case 'players':
      return 'all';
    case 'bracket':
      return 'full';
    case 'schedule':
      return 'calendar';
    case 'stats':
      return 'teams';
    case 'registrations':
      return 'pending';
    case 'settings':
      return mode === 'manage' ? 'venue' : 'participants';
    default:
      return '';
  }
}

export function navHref(
  basePath: string,
  tab: MainTab,
  sub?: string,
): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (sub) params.set('sub', sub);
  return `${basePath}?${params.toString()}`;
}

export type NavItem = {
  id: MainTab;
  label: string;
  subs?: { id: string; label: string }[];
};

export function buildNavItems(opts: {
  mode: 'public' | 'manage';
  hasKnockout: boolean;
  showMvp: boolean;
  showStandings: boolean;
  isOwner: boolean;
  canManage: boolean;
  /** False for score editors: they can run matches, not change structure or fees. */
  canConfigure?: boolean;
}): NavItem[] {
  const teamSubs: { id: string; label: string }[] = [
    { id: 'participants', label: 'Participants' },
    { id: 'rosters', label: 'Team rosters' },
  ];
  if (opts.canManage && opts.mode === 'manage') {
    teamSubs.push({ id: 'team-settings', label: 'Team settings' });
  }

  const bracketSubs: { id: string; label: string }[] = [
    { id: 'full', label: 'Full bracket' },
  ];
  if (opts.hasKnockout) {
    bracketSubs.push({ id: 'knockout', label: 'Knockout stage' });
  }

  const statsSubs: { id: string; label: string }[] = [
    { id: 'teams', label: 'Team performance' },
  ];
  if (opts.showMvp) {
    statsSubs.push({ id: 'leaderboard', label: 'MVP leaderboard' });
  }
  if (opts.hasKnockout) {
    statsSubs.push({ id: 'knockout', label: 'Knockout stats' });
  }

  const playerSubs: { id: string; label: string }[] = [
    { id: 'all', label: 'All players' },
    { id: 'by-team', label: 'By team' },
    { id: 'performance', label: 'Performance' },
  ];
  if (opts.canManage && opts.mode === 'manage') {
    playerSubs.push({ id: 'edit', label: 'Edit rosters' });
  }

  const scheduleSubs: { id: string; label: string }[] = [
    { id: 'calendar', label: 'Calendar' },
    { id: 'stations', label: 'Stations' },
    { id: 'queue', label: 'Station queue' },
  ];
  if (opts.canManage && opts.mode === 'manage') {
    scheduleSubs.push(
      { id: 'referees', label: 'Referees' },
      { id: 'generate', label: 'Auto-schedule' },
    );
  }

  if (opts.mode === 'public') {
    const items: NavItem[] = [
      {
        id: 'bracket',
        label: 'Bracket',
        subs: bracketSubs.length > 1 ? bracketSubs : undefined,
      },
      { id: 'teams', label: 'Participants' },
      { id: 'matches', label: 'Matches' },
    ];
    if (opts.showStandings) {
      items.push({ id: 'standings', label: 'Standings' });
    }
    items.push({
      id: 'schedule',
      label: 'Schedule',
      subs: [
        { id: 'calendar', label: 'Calendar' },
        { id: 'stations', label: 'Stations' },
        { id: 'queue', label: 'Station queue' },
      ],
    });
    return items;
  }

  const items: NavItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'teams', label: 'Teams', subs: teamSubs },
    { id: 'players', label: 'Players', subs: playerSubs },
    { id: 'bracket', label: 'Bracket', subs: bracketSubs },
    opts.canManage
      ? {
          id: 'matches',
          label: 'Matches',
          subs: [
            { id: 'play', label: 'Play' },
            { id: 'schedule', label: 'All matches' },
          ],
        }
      : { id: 'matches', label: 'Matches' },
    { id: 'schedule', label: 'Schedule', subs: scheduleSubs },
  ];

  if (opts.showStandings) {
    items.push({ id: 'standings', label: 'Standings' });
  }

  items.push({ id: 'stats', label: 'Stats', subs: statsSubs });

  if (opts.mode === 'manage' && opts.canManage && opts.canConfigure !== false) {
    items.push({
      id: 'registrations',
      label: 'Registrations',
      subs: [
        { id: 'pending', label: 'Pending' },
        { id: 'approved', label: 'Approved' },
        { id: 'waitlist', label: 'Waitlist' },
        { id: 'rejected', label: 'Rejected' },
        { id: 'form', label: 'Sign-up form' },
      ],
    });

    const settingsSubs: { id: string; label: string }[] = [
      { id: 'venue', label: 'Venue & hosting' },
      { id: 'rosters', label: 'Edit rosters' },
    ];
    if (opts.isOwner) {
      settingsSubs.push(
        { id: 'tournament', label: 'Tournament settings' },
        { id: 'standings', label: 'Standings & scoring' },
        { id: 'registration', label: 'Registration' },
        { id: 'branding', label: 'Branding' },
        { id: 'sharing', label: 'Sharing & embed' },
        { id: 'integrations', label: 'Integrations' },
        { id: 'media', label: 'Share images' },
      );
    }
    settingsSubs.push({ id: 'tools', label: 'Tools' });
    if (opts.isOwner) {
      settingsSubs.push({ id: 'danger', label: 'Advanced' });
    }
    items.push({ id: 'settings', label: 'Settings', subs: settingsSubs });
  }

  return items;
}
