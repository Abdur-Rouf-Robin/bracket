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
  label?: (key: string, fallback: string) => string;
}): NavItem[] {
  const L = (key: string, fallback: string) => opts.label?.(key, fallback) ?? fallback;
  const teamSubs: { id: string; label: string }[] = [
    { id: 'participants', label: L('manage.participants', 'Participants') },
    { id: 'rosters', label: L('manage.rosters', 'Team rosters') },
  ];
  if (opts.canManage && opts.mode === 'manage') {
    teamSubs.push({ id: 'team-settings', label: L('manage.teamSettings', 'Team settings') });
  }

  const bracketSubs: { id: string; label: string }[] = [
    { id: 'full', label: L('manage.full', 'Full bracket') },
  ];
  if (opts.hasKnockout) {
    bracketSubs.push({ id: 'knockout', label: L('manage.knockout', 'Knockout stage') });
  }

  const statsSubs: { id: string; label: string }[] = [
    { id: 'teams', label: L('manage.teamPerformance', 'Team performance') },
  ];
  if (opts.showMvp) {
    statsSubs.push({ id: 'leaderboard', label: L('manage.mvp', 'MVP leaderboard') });
  }
  if (opts.hasKnockout) {
    statsSubs.push({ id: 'knockout', label: L('manage.knockoutStats', 'Knockout stats') });
  }

  const playerSubs: { id: string; label: string }[] = [
    { id: 'all', label: L('manage.allPlayers', 'All players') },
    { id: 'by-team', label: L('manage.byTeam', 'By team') },
    { id: 'performance', label: L('manage.performance', 'Performance') },
  ];
  if (opts.canManage && opts.mode === 'manage') {
    playerSubs.push({ id: 'edit', label: L('manage.editRosters', 'Edit rosters') });
  }

  const scheduleSubs: { id: string; label: string }[] = [
    { id: 'calendar', label: L('manage.calendar', 'Calendar') },
    { id: 'stations', label: L('manage.stations', 'Stations') },
    { id: 'queue', label: L('manage.queue', 'Station queue') },
  ];
  if (opts.canManage && opts.mode === 'manage') {
    scheduleSubs.push(
      { id: 'referees', label: L('manage.referees', 'Referees') },
      { id: 'generate', label: L('manage.autoSchedule', 'Auto-schedule') },
    );
  }

  if (opts.mode === 'public') {
    const items: NavItem[] = [
      {
        id: 'bracket',
        label: L('manage.bracket', 'Bracket'),
        subs: bracketSubs.length > 1 ? bracketSubs : undefined,
      },
      { id: 'teams', label: L('manage.participants', 'Participants') },
      { id: 'matches', label: L('manage.matches', 'Matches') },
    ];
    if (opts.showStandings) {
      items.push({ id: 'standings', label: L('manage.standings', 'Standings') });
    }
    items.push({
      id: 'schedule',
      label: L('manage.schedule', 'Schedule'),
      subs: [
        { id: 'calendar', label: L('manage.calendar', 'Calendar') },
        { id: 'stations', label: L('manage.stations', 'Stations') },
        { id: 'queue', label: L('manage.queue', 'Station queue') },
      ],
    });
    return items;
  }

  const items: NavItem[] = [
    { id: 'overview', label: L('manage.overview', 'Overview') },
    { id: 'teams', label: L('manage.teams', 'Teams'), subs: teamSubs },
    { id: 'players', label: L('manage.players', 'Players'), subs: playerSubs },
    { id: 'bracket', label: L('manage.bracket', 'Bracket'), subs: bracketSubs },
    opts.canManage
      ? {
          id: 'matches',
          label: L('manage.matches', 'Matches'),
          subs: [
            { id: 'play', label: L('manage.play', 'Play') },
            { id: 'schedule', label: L('manage.allMatches', 'All matches') },
          ],
        }
      : { id: 'matches', label: L('manage.matches', 'Matches') },
    { id: 'schedule', label: L('manage.schedule', 'Schedule'), subs: scheduleSubs },
  ];

  if (opts.showStandings) {
    items.push({ id: 'standings', label: L('manage.standings', 'Standings') });
  }

  items.push({ id: 'stats', label: L('manage.stats', 'Stats'), subs: statsSubs });

  if (opts.mode === 'manage' && opts.canManage && opts.canConfigure !== false) {
    items.push({
      id: 'registrations',
      label: L('manage.registrations', 'Registrations'),
      subs: [
        { id: 'pending', label: L('manage.pending', 'Pending') },
        { id: 'approved', label: L('manage.approved', 'Approved') },
        { id: 'waitlist', label: L('manage.waitlist', 'Waitlist') },
        { id: 'rejected', label: L('manage.rejected', 'Rejected') },
        { id: 'form', label: L('manage.signup', 'Sign-up form') },
      ],
    });

    const settingsSubs: { id: string; label: string }[] = [
      { id: 'venue', label: L('manage.venue', 'Venue & hosting') },
      { id: 'rosters', label: L('manage.editRosters', 'Edit rosters') },
    ];
    if (opts.isOwner) {
      settingsSubs.push(
        { id: 'tournament', label: L('manage.tournament', 'Tournament settings') },
        { id: 'standings', label: L('manage.scoring', 'Standings & scoring') },
        { id: 'registration', label: L('manage.registration', 'Registration') },
        { id: 'branding', label: L('manage.branding', 'Branding') },
        { id: 'sharing', label: L('manage.sharing', 'Sharing & embed') },
        { id: 'integrations', label: L('manage.integrations', 'Integrations') },
        { id: 'media', label: L('manage.media', 'Share images') },
      );
    }
    settingsSubs.push({ id: 'tools', label: L('manage.tools', 'Tools') });
    if (opts.isOwner) {
      settingsSubs.push({ id: 'danger', label: L('manage.advanced', 'Advanced') });
    }
    items.push({ id: 'settings', label: L('manage.settings', 'Settings'), subs: settingsSubs });
  }

  return items;
}
