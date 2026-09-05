/**
 * Help center content. Structured so it can be rendered without markdown:
 * each section has a heading and a body made of paragraphs and/or bullets.
 */
export type HelpSection = {
  heading: string;
  /** Plain paragraphs. */
  body?: string[];
  /** Bullet list rendered after the paragraphs. */
  bullets?: string[];
};

export type HelpCategoryId =
  | 'getting-started'
  | 'formats'
  | 'participants'
  | 'scheduling'
  | 'standings'
  | 'sharing'
  | 'communities'
  | 'events'
  | 'account'
  | 'troubleshooting';

export type HelpCategory = {
  id: HelpCategoryId;
  title: string;
  description: string;
};

export type HelpArticle = {
  slug: string;
  title: string;
  category: HelpCategoryId;
  summary: string;
  keywords?: string[];
  sections: HelpSection[];
  related?: string[];
};

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'getting-started', title: 'Getting started', description: 'Create your first tournament and learn the basics.' },
  { id: 'formats', title: 'Formats', description: 'Elimination, round robin, Swiss, groups, leaderboards and racing.' },
  { id: 'participants', title: 'Participants & registration', description: 'Sign-up pages, check-in, waitlists, rosters and custom fields.' },
  { id: 'scheduling', title: 'Scheduling', description: 'Stations, referees, auto-scheduling and rescheduling.' },
  { id: 'standings', title: 'Standings & tiebreakers', description: 'How ranking criteria, adjustments and set scoring work.' },
  { id: 'sharing', title: 'Sharing & embed', description: 'Embeds, QR codes, TV mode, exports and privacy.' },
  { id: 'communities', title: 'Communities', description: 'Roles, followers, Elo rankings and templates.' },
  { id: 'events', title: 'Events', description: 'Multi-tournament events, tickets and check-in.' },
  { id: 'account', title: 'Account & billing', description: 'Plans, Premier, invoices and account settings.' },
  { id: 'troubleshooting', title: 'Troubleshooting', description: 'Fixing common problems and recovering data.' },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ---------------------------------------------------------------- getting started
  {
    slug: 'creating-a-tournament',
    title: 'Creating your first tournament',
    category: 'getting-started',
    summary: 'A five-minute walkthrough from a blank page to a published bracket.',
    keywords: ['new', 'create', 'wizard', 'start'],
    sections: [
      {
        heading: 'Start the wizard',
        body: [
          'Click New in the header (or Create → Tournament) to open the tournament wizard. Give the tournament a name, optionally pick a game or sport, and choose whether it is public or private. A URL slug is generated from the name; you can edit it before publishing.',
        ],
      },
      {
        heading: 'Add participants',
        body: ['Paste one name per line, import a CSV, or open public sign-ups so participants register themselves. Teams can have rosters with players, captains and substitutes.'],
        bullets: [
          'Order matters: the list order becomes the default seeding.',
          'Use the shuffle button to randomize seeds, or drag rows to reorder.',
          'Duplicate names are flagged before you continue.',
        ],
      },
      {
        heading: 'Pick a format and generate',
        body: [
          'Choose a format (we recommend one based on your field size), review settings such as third-place match or best-of series, and click Generate. The bracket or schedule is created instantly and can be regenerated as long as no results have been entered.',
        ],
      },
      {
        heading: 'Share and run it',
        body: ['Your public page is live immediately at /t/your-slug. Share the link, print a QR poster, or embed the bracket. Enter scores from the Matches → Play tab on any device.'],
      },
    ],
    related: ['formats-explained', 'seeding-and-byes', 'sharing-a-tournament'],
  },
  {
    slug: 'tournament-lifecycle',
    title: 'Tournament stages: setup, registration, live, completed',
    category: 'getting-started',
    summary: 'What each stage means and which actions are available in each.',
    keywords: ['status', 'draft', 'active', 'finalize', 'reopen'],
    sections: [
      {
        heading: 'Setup (draft)',
        body: ['You have a tournament but no bracket yet. Add participants, adjust settings and generate when ready. Nothing is final and you can regenerate as often as you like.'],
      },
      {
        heading: 'Registration',
        body: ['If open sign-ups are enabled, participants can register until you close registration or generate the bracket. Pending registrations can be approved, waitlisted or rejected.'],
      },
      {
        heading: 'Live',
        body: ['Once matches exist and results start coming in the tournament is live. Standings, brackets and embeds update in real time for every viewer.'],
      },
      {
        heading: 'Completed',
        body: ['Mark the tournament completed from the manage page. Final placements are locked, result emails go out (if enabled) and Elo rankings are updated. You can reopen a completed tournament if you need to correct a result.'],
      },
    ],
    related: ['creating-a-tournament', 'deleting-and-recovering'],
  },
  {
    slug: 'the-manage-page',
    title: 'Understanding the manage page',
    category: 'getting-started',
    summary: 'Where everything lives: tabs, sub-tabs and the status stepper.',
    keywords: ['manage', 'tabs', 'overview', 'settings'],
    sections: [
      {
        heading: 'Tabs',
        bullets: [
          'Overview — description, announcements and key stats.',
          'Teams / Players — participants, rosters and check-in state.',
          'Bracket — the full tree and knockout stage views.',
          'Matches — Play (enter results) and All matches.',
          'Schedule — calendar, stations, station queue, referees and auto-schedule.',
          'Standings & Stats — tables, player stats and MVP leaderboard.',
          'Registrations — pending, approved, waitlist and the sign-up form.',
          'Settings — venue, rosters, scoring, registration, branding, sharing, integrations and tools.',
        ],
      },
      {
        heading: 'The status stepper',
        body: ['The header shows where you are (Setup → Registration → Live → Completed) and always offers the single most useful next action: add participants, generate the bracket, enter results, or finalize.'],
      },
    ],
  },

  // ---------------------------------------------------------------- formats
  {
    slug: 'formats-explained',
    title: 'Tournament formats explained',
    category: 'formats',
    summary: 'Which format fits your event, with match counts for each.',
    keywords: ['single elimination', 'double elimination', 'round robin', 'swiss', 'groups', 'leaderboard', 'racing'],
    sections: [
      {
        heading: 'Single elimination',
        body: ['Lose once and you are out. Fastest format: n − 1 matches for n participants (plus one for a third-place match). Best when time is short or the field is large.'],
      },
      {
        heading: 'Double elimination',
        body: ['Everyone must lose twice. Losers drop into a lower bracket and can fight back to the grand final. 2n − 2 matches, or 2n − 1 if the bracket reset is played. Fairer than single elimination, roughly twice as long.'],
      },
      {
        heading: 'Round robin',
        body: ['Everyone plays everyone. n(n − 1) / 2 matches per meeting; double round robin doubles that. Produces the fairest ranking but grows quickly — ideal for 4–10 participants.'],
      },
      {
        heading: 'Swiss system',
        body: ['Fixed number of rounds (typically log₂ n) where each round pairs participants with similar records. Nobody is eliminated, no rematches. Great for large fields with limited time — chess, card games, esports opens.'],
      },
      {
        heading: 'Groups + knockout',
        body: ['World-Cup style. Round robin groups first, then the top N (optionally with best third-placed teams) advance to a knockout bracket seeded across groups.'],
      },
      {
        heading: 'Free for all, leaderboard and racing',
        body: ['For events without head-to-head matches: placement-based heats (battle royale), cumulative points across events (leaderboard), and time trials, single races or multi-race Grand Prix series with F1-style points.'],
      },
    ],
    related: ['seeding-and-byes', 'third-place-and-placement-matches', 'swiss-pairing'],
  },
  {
    slug: 'seeding-and-byes',
    title: 'Seeding and byes',
    category: 'formats',
    summary: 'How seeds are placed in the bracket and why some participants skip round one.',
    keywords: ['seed', 'bye', 'power of two', 'traditional', 'list order'],
    sections: [
      {
        heading: 'Traditional seeding',
        body: ['The default places seed 1 against the lowest seed, seed 2 against the second-lowest, and so on, so the top seeds can only meet in the final. Switch to List order in settings to place participants exactly as listed.'],
      },
      {
        heading: 'Byes',
        body: ['Brackets need a power-of-two size (4, 8, 16, 32…). When you have, say, 13 participants, the bracket is sized to 16 and three top seeds receive a bye — they skip round one automatically. Byes are shown in the bracket so everyone can see why.'],
      },
      {
        heading: 'Randomizing',
        body: ['Use Shuffle before generating to randomize the order, or enable Auditable draw to record the seed and produce a verifiable draw log.'],
      },
    ],
    related: ['formats-explained', 'auditable-draws'],
  },
  {
    slug: 'third-place-and-placement-matches',
    title: 'Third-place and placement matches',
    category: 'formats',
    summary: 'Add a bronze final or full placement ladders to elimination brackets.',
    keywords: ['3rd place', 'bronze', 'consolation', 'placement', '5th'],
    sections: [
      {
        heading: 'Third-place match',
        body: ['Enable Third-place match in Tournament settings before generating. The two semi-final losers meet in an extra match that decides ranks 3 and 4.'],
      },
      {
        heading: 'Placement ladders',
        body: ['Set Placement matches through to 8 or 16 to decide every rank (5th–8th, 9th–16th…). Useful for youth events and qualifiers where every position counts.'],
      },
      {
        heading: 'Consolation bracket',
        body: ['Turn on Consolation bracket to give round-one losers a separate bracket of their own — a common cup format that keeps everyone playing.'],
      },
    ],
    related: ['formats-explained'],
  },
  {
    slug: 'swiss-pairing',
    title: 'How Swiss pairing works',
    category: 'formats',
    summary: 'Score groups, colour balance, Buchholz and the number of rounds to run.',
    keywords: ['swiss', 'dutch', 'pairing', 'buchholz', 'rounds'],
    sections: [
      {
        heading: 'Pairing rules',
        body: ['Each round pairs participants with the same (or closest) score who have not met before. The FIDE Dutch mode also balances home/away (colour) assignments. Rounds are generated one at a time after the previous round completes.'],
      },
      {
        heading: 'How many rounds?',
        body: ['A good rule is ⌈log₂ n⌉ rounds to find a clear winner — 4 rounds for 9–16 participants, 5 for 17–32, 6 for 33–64. You can set any number from 2 to 12.'],
      },
      {
        heading: 'Tiebreakers',
        body: ['Buchholz (sum of opponents’ scores), Median Buchholz and Sonneborn-Berger are available as ranking criteria and shown as standings columns.'],
      },
    ],
    related: ['standings-criteria'],
  },
  {
    slug: 'groups-and-knockout',
    title: 'Group stages, draws and advancement',
    category: 'formats',
    summary: 'Group draw methods, best third-placed teams and knockout seeding.',
    keywords: ['groups', 'pot draw', 'serpentine', 'best thirds', 'advance'],
    sections: [
      {
        heading: 'Drawing groups',
        bullets: [
          'Serpentine (by seed) — 1,2,3,4 then 8,7,6,5 for balanced groups.',
          'Pot draw — UEFA style: pots by seed, one from each pot per group, random within pots.',
          'Random balanced or fully random — for casual events.',
        ],
      },
      {
        heading: 'Advancement',
        body: ['Set how many advance per group (usually 2). Enable Best third-placed teams to fill a bracket (e.g. 6 groups × 2 + 4 thirds = 16). Knockout pairings follow international conventions so group winners avoid each other early.'],
      },
      {
        heading: 'Two-legged ties',
        body: ['Football-style home and away legs are available for groups and knockouts, with aggregate scoring, optional away-goals rule, extra time and penalties.'],
      },
    ],
    related: ['standings-criteria', 'auditable-draws'],
  },
  {
    slug: 'auditable-draws',
    title: 'Auditable draws and the live draw ceremony',
    category: 'formats',
    summary: 'Prove your draw was fair with a recorded seed and step-by-step ceremony.',
    keywords: ['draw', 'ceremony', 'seed', 'audit', 'fair'],
    sections: [
      {
        heading: 'Auditable draw',
        body: ['Enable Auditable draw in settings. Every shuffle and group assignment is derived from a recorded seed and written to a draw log with input and output order, visible on the public page.'],
      },
      {
        heading: 'Draw ceremony',
        body: ['Open /t/your-slug/draw to reveal the draw one pick at a time on a projector or stream. Viewers see each step live.'],
      },
    ],
  },
  {
    slug: 'best-of-series-and-sets',
    title: 'Best-of series, set scoring and bracket reset',
    category: 'formats',
    summary: 'Configure Bo3/Bo5 series, set-based results and double-elimination resets.',
    keywords: ['best of', 'bo3', 'sets', 'tennis', 'volleyball', 'bracket reset'],
    sections: [
      {
        heading: 'Best-of series',
        body: ['Set Knockout best-of to 3, 5 or 7. Results are entered as games won per side and validated so one side reaches the required wins.'],
      },
      {
        heading: 'Set-based scoring',
        body: ['Enable Set-based scoring for tennis, padel, volleyball or table tennis. Enter each set score; sets won and set difference become available tiebreakers.'],
      },
      {
        heading: 'Bracket reset',
        body: ['In double elimination the losers-bracket champion must beat the winners-bracket champion twice. Enable Bracket reset to add that optional second grand final.'],
      },
    ],
    related: ['set-based-scoring'],
  },

  // ---------------------------------------------------------------- participants
  {
    slug: 'sign-up-pages-and-waitlists',
    title: 'Sign-up pages and waitlists',
    category: 'participants',
    summary: 'Let participants register themselves, cap the field and manage the waitlist.',
    keywords: ['registration', 'sign up', 'waitlist', 'approve', 'open'],
    sections: [
      {
        heading: 'Enable open sign-ups',
        body: ['In Settings → Registration choose Open sign-up. Set the maximum participants, an opening and closing time, and whether registrations are approved automatically or reviewed by you.'],
      },
      {
        heading: 'Waitlist',
        body: ['When the field is full new registrations join a waitlist in order. Withdrawals promote the next waitlisted entry automatically; you can also promote manually from Registrations → Waitlist.'],
      },
      {
        heading: 'Reviewing registrations',
        body: ['Approve, reject or waitlist entries from the Registrations tab. Approved registrations become participants; rejected ones are notified with an optional note.'],
      },
    ],
    related: ['custom-registration-fields', 'check-in', 'paid-registrations'],
  },
  {
    slug: 'custom-registration-fields',
    title: 'Custom registration fields and waivers',
    category: 'participants',
    summary: 'Collect exactly the information you need at sign-up.',
    keywords: ['fields', 'form', 'waiver', 'phone', 'skill'],
    sections: [
      {
        heading: 'Adding fields',
        body: ['In Registrations → Sign-up form add text, number, email, phone, URL, select or checkbox fields. Mark fields required and add help text. Responses appear on each registration and in CSV exports.'],
      },
      {
        heading: 'Waivers and rules',
        body: ['Paste your waiver text to require acceptance before submission. The acceptance timestamp is stored with the registration.'],
      },
      {
        heading: 'Restrictions',
        body: ['Require a verified email, restrict by country, or require a full team roster before a registration is accepted.'],
      },
    ],
  },
  {
    slug: 'check-in',
    title: 'Check-in',
    category: 'participants',
    summary: 'Confirm who actually showed up before you generate the bracket.',
    keywords: ['check in', 'no show', 'attendance'],
    sections: [
      {
        heading: 'How it works',
        body: ['Enable Require check-in and set how many minutes before start the window opens. Participants check in from their participant page or the public page; you can also check people in from Teams → Participants.'],
      },
      {
        heading: 'Generating with no-shows',
        body: ['When you generate the bracket you can exclude anyone not checked in. Their spots become byes or are filled from the waitlist.'],
      },
    ],
    related: ['sign-up-pages-and-waitlists'],
  },
  {
    slug: 'teams-and-rosters',
    title: 'Teams, rosters and substitutes',
    category: 'participants',
    summary: 'Set players per team, captains, subs and roster locks.',
    keywords: ['roster', 'players', 'captain', 'substitute', 'lock'],
    sections: [
      {
        heading: 'Team settings',
        body: ['Set Players per team and optional substitute slots. Rosters can be edited by organizers and, if allowed, by the registering captain until the roster lock.'],
      },
      {
        heading: 'Roster lock',
        body: ['Enable Lock roster after generate to freeze rosters once the bracket exists, so player stats stay consistent.'],
      },
      {
        heading: 'Player stats',
        body: ['With rosters in place you can record per-player stats on each match (goals, assists, cards, kills, runs…) and the MVP leaderboard is computed automatically.'],
      },
    ],
    related: ['player-stats-and-mvp'],
  },
  {
    slug: 'paid-registrations',
    title: 'Charging an entry fee',
    category: 'participants',
    summary: 'Collect entry fees with Stripe during sign-up.',
    keywords: ['stripe', 'fee', 'payment', 'entry'],
    sections: [
      {
        heading: 'Set an entry fee',
        body: ['In Settings → Registration set the entry fee and currency. Participants are sent to Stripe Checkout after filling in the form; the registration is marked paid when the payment completes.'],
      },
      {
        heading: 'Fees and refunds',
        body: ['Payments go to your connected Stripe account. A small platform fee applies on both plans. Refunds are issued from your Stripe dashboard; mark the registration refunded to keep records in sync.'],
      },
    ],
  },
  {
    slug: 'participant-access-pages',
    title: 'Participant and referee access pages',
    category: 'participants',
    summary: 'Private links for participants to check in, report scores and see their schedule.',
    keywords: ['participant page', 'referee', 'report score', 'private link'],
    sections: [
      {
        heading: 'Participant pages',
        body: ['Each participant can receive a private link (/p/…) showing their upcoming matches, station and check-in button. If Allow participants to report scores is on, they can submit results that you confirm.'],
      },
      {
        heading: 'Referee pages',
        body: ['Referees get a similar link (/r/…) listing their assigned matches with score entry.'],
      },
    ],
  },

  // ---------------------------------------------------------------- scheduling
  {
    slug: 'stations-and-station-queue',
    title: 'Stations and the station queue',
    category: 'scheduling',
    summary: 'Assign matches to tables, courts or PCs and show who plays next.',
    keywords: ['station', 'court', 'table', 'queue', 'up next'],
    sections: [
      {
        heading: 'Create stations',
        body: ['In Schedule → Stations add each court, table, setup or pitch. Private details (e.g. login info) are visible only to organizers.'],
      },
      {
        heading: 'Assigning matches',
        body: ['Assign a station on any match, or let the auto-scheduler do it. Stations can be open, in use or closed.'],
      },
      {
        heading: 'Station queue',
        body: ['Schedule → Station queue shows matches ready to play in priority order. Put it on a screen at the venue so players know where to go next without asking.'],
      },
    ],
    related: ['auto-scheduling', 'tv-display'],
  },
  {
    slug: 'auto-scheduling',
    title: 'Auto-scheduling matches',
    category: 'scheduling',
    summary: 'Generate match times across venues and referees in one click (Premier).',
    keywords: ['schedule', 'auto', 'time slots', 'rest', 'referee', 'venue'],
    sections: [
      {
        heading: 'Before you start',
        body: ['Generate the bracket, create stations and optionally referees with availability windows. Set the tournament start time and default match duration.'],
      },
      {
        heading: 'Run the scheduler',
        body: ['In Schedule → Auto-schedule choose the start time, match duration, gap between matches, minimum rest per participant and which stations to use. Review the proposed times, then apply.'],
      },
      {
        heading: 'Adjusting afterwards',
        body: ['Drag matches in the calendar or edit times individually. Re-run the scheduler for later rounds only, leaving completed matches untouched.'],
      },
    ],
    related: ['rescheduling-matches', 'stations-and-station-queue'],
  },
  {
    slug: 'rescheduling-matches',
    title: 'Rescheduling and postponing matches',
    category: 'scheduling',
    summary: 'Change times, swap stations and handle delays without breaking the bracket.',
    keywords: ['reschedule', 'postpone', 'delay', 'time'],
    sections: [
      {
        heading: 'Change a single match',
        body: ['Open the match, edit the scheduled time, station or referee and save. Participants are notified if notifications are enabled.'],
      },
      {
        heading: 'Shift everything',
        body: ['Running late? Use Schedule → Auto-schedule for the remaining rounds with a new start time, or mark the schedule as Tentative to signal times may move.'],
      },
    ],
  },
  {
    slug: 'referees',
    title: 'Referees and officials',
    category: 'scheduling',
    summary: 'Add referees, set availability and assign them to matches.',
    keywords: ['referee', 'umpire', 'official', 'availability'],
    sections: [
      {
        heading: 'Adding referees',
        body: ['In Schedule → Referees add names and optional emails. Link a referee to a user account so they can enter scores from their own device.'],
      },
      {
        heading: 'Assignments',
        body: ['Assign manually per match or let the auto-scheduler distribute matches evenly while respecting availability windows.'],
      },
    ],
    related: ['auto-scheduling', 'participant-access-pages'],
  },

  // ---------------------------------------------------------------- standings
  {
    slug: 'standings-criteria',
    title: 'Standings criteria and tiebreakers explained',
    category: 'standings',
    summary: 'Points, head-to-head, score difference, Buchholz, Sonneborn-Berger, sets and more.',
    keywords: ['tiebreaker', 'head to head', 'goal difference', 'buchholz', 'sonneborn', 'points'],
    sections: [
      {
        heading: 'How ranking works',
        body: ['Standings are sorted by the primary Rank by setting (tournament points by default) and then by an ordered list of tiebreak criteria. Edit both in Settings → Standings & scoring. Criteria are applied in order until the tie is broken.'],
      },
      {
        heading: 'Available criteria',
        bullets: [
          'Points — win/draw/loss points (configurable, e.g. 3-1-0).',
          'Wins — number of matches won.',
          'Head-to-head — results between the tied participants only (points, then difference, then scored).',
          'Score difference — scored minus conceded (goal difference, point differential).',
          'Score for / against — total scored, or fewest conceded.',
          'Sets won / set difference — for set-based sports.',
          'Buchholz / Median Buchholz — sum of opponents’ scores (Swiss).',
          'Sonneborn-Berger — sum of defeated opponents’ scores plus half of drawn opponents’ scores (Swiss).',
          'Net run rate — cricket.',
          'Fair play — fewer disciplinary points rank higher.',
          'Draw of lots — a recorded random tiebreak as the last resort.',
        ],
      },
      {
        heading: 'Common presets',
        body: ['Football: points, head-to-head, goal difference, goals scored. Basketball: wins, head-to-head, point differential. Chess/Swiss: points, Buchholz, Sonneborn-Berger. Volleyball: points, set ratio, point ratio.'],
      },
    ],
    related: ['manual-adjustments', 'set-based-scoring'],
  },
  {
    slug: 'manual-adjustments',
    title: 'Manual standings adjustments',
    category: 'standings',
    summary: 'Deduct or award points for forfeits, discipline or bonuses.',
    keywords: ['adjustment', 'deduct', 'penalty', 'bonus points'],
    sections: [
      {
        heading: 'Adding an adjustment',
        body: ['From Standings (manage view) choose Adjust, pick the participant, enter positive or negative points and a reason. Adjustments are shown as a separate column and in the participant’s tooltip so the table stays transparent.'],
      },
      {
        heading: 'Forfeits',
        body: ['Record a forfeit on the match itself instead; the configured forfeit score is applied and the winner advances automatically.'],
      },
    ],
  },
  {
    slug: 'set-based-scoring',
    title: 'Set-based scoring (tennis, volleyball, padel, table tennis)',
    category: 'standings',
    summary: 'Enter set scores and rank by sets and points ratios.',
    keywords: ['sets', 'tennis', 'volleyball', 'padel', 'table tennis'],
    sections: [
      {
        heading: 'Enable it',
        body: ['Turn on Set-based scoring and set the best-of (3 or 5). Score entry switches to per-set inputs and validates the winner reached the required sets.'],
      },
      {
        heading: 'Standings columns',
        body: ['Add Sets won, Set difference and Score difference to the standings columns and criteria. Sets ratio and points ratio are computed automatically.'],
      },
    ],
    related: ['standings-criteria'],
  },
  {
    slug: 'player-stats-and-mvp',
    title: 'Player stats and MVP awards',
    category: 'standings',
    summary: 'Record per-player statistics and pick MVPs automatically or manually.',
    keywords: ['mvp', 'stats', 'goals', 'assists', 'kills', 'leaderboard'],
    sections: [
      {
        heading: 'Recording stats',
        body: ['When entering a result, expand Player stats to record goals, assists, cards, points, kills, deaths or a rating per player. Fields depend on the sport preset.'],
      },
      {
        heading: 'MVP',
        body: ['Auto mode computes an MVP score from weighted stats (with round multipliers for finals); Manual mode lets you pick the MVP yourself. The Stats → MVP leaderboard tab ranks players across the tournament.'],
      },
    ],
    related: ['teams-and-rosters'],
  },

  // ---------------------------------------------------------------- sharing
  {
    slug: 'sharing-a-tournament',
    title: 'Sharing your tournament',
    category: 'sharing',
    summary: 'Links, social cards, QR posters and result images.',
    keywords: ['share', 'link', 'social', 'card', 'image'],
    sections: [
      {
        heading: 'Public link',
        body: ['Every tournament has a public page at /t/your-slug. Use the Share menu in the header to copy the link, post to social networks or download a QR code.'],
      },
      {
        heading: 'Match and result images',
        body: ['Generate pre-match and result cards for any match from the Matches tab — ideal for Instagram stories and stream overlays.'],
      },
    ],
    related: ['embedding', 'qr-codes', 'tv-display'],
  },
  {
    slug: 'embedding',
    title: 'Embedding a bracket on your website',
    category: 'sharing',
    summary: 'Drop a live bracket, schedule or standings into any site.',
    keywords: ['embed', 'iframe', 'website', 'theme'],
    sections: [
      {
        heading: 'Embed code',
        body: ['Copy the iframe from Settings → Sharing & embed or the Share menu. Choose the default tab (bracket, standings, schedule) and — on Premier — a light, dark or custom theme to match your site.'],
      },
      {
        heading: 'Sizing',
        body: ['The embed is responsive in width; set a height that fits your bracket size. Wide brackets scroll horizontally inside the frame.'],
      },
    ],
  },
  {
    slug: 'qr-codes',
    title: 'QR codes and printable posters',
    category: 'sharing',
    summary: 'Let people at the venue open the live bracket with their camera.',
    keywords: ['qr', 'poster', 'print'],
    sections: [
      {
        heading: 'Get your QR code',
        body: ['Open /t/your-slug/qr for a print-ready page with the QR code, tournament name and URL. Print it and post it at the entrance, on each station or on the scoreboard.'],
      },
    ],
    related: ['printing-and-exports'],
  },
  {
    slug: 'tv-display',
    title: 'TV display mode',
    category: 'sharing',
    summary: 'Auto-rotating full-screen view for venue screens.',
    keywords: ['tv', 'display', 'screen', 'kiosk', 'rotate'],
    sections: [
      {
        heading: 'Open TV mode',
        body: ['Visit /t/your-slug/tv on any browser connected to a TV and press F11 for full screen. The view rotates between bracket, upcoming matches, station queue and standings at the interval set in Settings → Sharing.'],
      },
    ],
    related: ['stations-and-station-queue'],
  },
  {
    slug: 'printing-and-exports',
    title: 'Printing brackets and exporting CSV / PDF',
    category: 'sharing',
    summary: 'Paper brackets for the wall and spreadsheets for the office.',
    keywords: ['print', 'pdf', 'csv', 'export', 'download'],
    sections: [
      {
        heading: 'Print',
        body: ['Open /t/your-slug/print for a clean, print-optimized bracket. Use landscape for large brackets. The bracket generator also offers Print and Download PNG for quick offline brackets.'],
      },
      {
        heading: 'Exports (Premier)',
        body: ['From Settings → Tools export participants, registrations, schedule, results and standings as CSV, or a full tournament summary as PDF.'],
      },
    ],
  },
  {
    slug: 'private-and-password-tournaments',
    title: 'Private and password-protected tournaments',
    category: 'sharing',
    summary: 'Control who can find and view your tournament.',
    keywords: ['private', 'password', 'hidden', 'unlisted', 'seo'],
    sections: [
      {
        heading: 'Visibility options',
        bullets: [
          'Public — listed in Browse and search engines.',
          'Unlisted — reachable by link only; hidden from Browse and search engines.',
          'Password — viewers must enter a password you set before seeing the page.',
          'Private — only organizers can view until published.',
        ],
      },
      {
        heading: 'Where to set it',
        body: ['Settings → Sharing & embed controls listing and search engine indexing; Settings → Tournament controls the view password.'],
      },
    ],
  },

  // ---------------------------------------------------------------- communities
  {
    slug: 'communities-and-roles',
    title: 'Communities and member roles',
    category: 'communities',
    summary: 'Give your club or league a home and share the organizing work.',
    keywords: ['community', 'club', 'league', 'roles', 'owner', 'admin', 'collaborator'],
    sections: [
      {
        heading: 'Creating a community',
        body: ['Create → Community. Add a name, logo, banner, location and the games you play. Tournaments and events can then be hosted under the community and appear on its page.'],
      },
      {
        heading: 'Roles',
        bullets: [
          'Owner — full control, billing and deletion.',
          'Admin — manage members, settings, all tournaments and events.',
          'Collaborator — create and manage tournaments and events.',
          'Affiliate — listed as part of the community, can be assigned to tournaments.',
        ],
      },
      {
        heading: 'Followers and announcements',
        body: ['Anyone can follow a community to receive notifications about new tournaments and announcements.'],
      },
    ],
    related: ['elo-rankings', 'templates'],
  },
  {
    slug: 'elo-rankings',
    title: 'Elo rankings and K-factors',
    category: 'communities',
    summary: 'Cross-tournament ratings for your community.',
    keywords: ['elo', 'rating', 'ranking', 'k-factor'],
    sections: [
      {
        heading: 'Create a ranking',
        body: ['On your community page open Rankings and create one per game or division. Set the starting rating (default 1000) and link tournaments to it; completed matches update ratings automatically.'],
      },
      {
        heading: 'K-factors',
        body: ['The K-factor controls how much a single result moves a rating. New players use a higher K (fast calibration), established players a normal K, and players above the pro threshold a lower K for stability. Defaults: 40 / 20 / 10.'],
      },
      {
        heading: 'Expected score',
        body: ['A player rated 200 points higher is expected to win about 76% of the time; beating a much stronger opponent yields a big gain, while losing to a weaker one costs more.'],
      },
    ],
  },
  {
    slug: 'templates',
    title: 'Tournament templates',
    category: 'communities',
    summary: 'Save your settings once and reuse them for every event.',
    keywords: ['template', 'reuse', 'preset'],
    sections: [
      {
        heading: 'Saving a template',
        body: ['From Settings → Tools choose Save as template. Format, scoring, registration form, branding and sharing settings are stored (participants are not).'],
      },
      {
        heading: 'Using a template',
        body: ['On the dashboard or in the wizard pick Use template. Community templates are shared with all collaborators.'],
      },
    ],
  },

  // ---------------------------------------------------------------- events
  {
    slug: 'events-and-tickets',
    title: 'Events, tickets and door check-in',
    category: 'events',
    summary: 'Bundle tournaments under one event and sell tickets.',
    keywords: ['event', 'ticket', 'order', 'venue', 'check in'],
    sections: [
      {
        heading: 'Creating an event',
        body: ['Create → Event. Add dates, venue or stream, and attach one or more tournaments. The event page shows a combined schedule and links to each tournament.'],
      },
      {
        heading: 'Tickets',
        body: ['Add ticket types with price, quantity and sales window. Buyers pay through Stripe and receive a QR code by email. Scan it at the door from the event manage page to check them in.'],
      },
    ],
  },
  {
    slug: 'predictions-and-voting',
    title: 'Bracket predictions and match voting',
    category: 'events',
    summary: 'Engage fans with prediction contests and pre-match polls.',
    keywords: ['prediction', 'pick', 'vote', 'poll', 'fans'],
    sections: [
      {
        heading: 'Predictions',
        body: ['Enable Bracket predictions before the tournament starts. Fans pick winners for every match; picks lock when each match starts and a leaderboard scores accuracy. Optionally allow anonymous guesses and custom questions (e.g. top scorer).'],
      },
      {
        heading: 'Match voting',
        body: ['Enable Match voting to show a "who will win?" poll on each upcoming match. Results are shown as a live percentage bar.'],
      },
    ],
  },

  // ---------------------------------------------------------------- account
  {
    slug: 'plans-and-billing',
    title: 'Plans, Premier and billing',
    category: 'account',
    summary: 'What is included in Standard and Premier, and how billing works.',
    keywords: ['premier', 'plan', 'billing', 'invoice', 'subscription', 'cancel'],
    sections: [
      {
        heading: 'Standard vs Premier',
        body: ['Standard is free forever: unlimited tournaments, communities and events with up to 256 participants each, ad-supported. Premier removes ads for you and your viewers, raises the limit to 512 participants, and unlocks custom embed themes and branding, 25 MB file attachments, the auto-scheduler with referees, CSV/PDF exports, one Pro community and priority support.'],
      },
      {
        heading: 'Upgrading',
        body: ['Go to Pricing, choose monthly or yearly and click Upgrade. Checkout is handled by Stripe. Premier activates immediately after payment.'],
      },
      {
        heading: 'Managing and cancelling',
        body: ['Settings → Billing shows your plan, renewal date and a Manage subscription button that opens the Stripe billing portal for invoices, card changes and cancellation. Cancelled plans stay active until the period ends.'],
      },
    ],
  },
  {
    slug: 'account-settings',
    title: 'Account settings, username and email verification',
    category: 'account',
    summary: 'Update your profile, verify your email and manage security.',
    keywords: ['profile', 'username', 'avatar', 'verify', 'password', 'timezone'],
    sections: [
      {
        heading: 'Profile',
        body: ['Set a display name, username (your public profile at /u/username), avatar, bio, country and timezone. Times across the app are shown in your timezone.'],
      },
      {
        heading: 'Email verification',
        body: ['Verify your email to register for tournaments that require it and to receive notifications. Resend the verification link from the dashboard banner or Settings.'],
      },
      {
        heading: 'Security',
        body: ['Change your password in Settings → Security. Use Forgot password on the sign-in page if you are locked out.'],
      },
    ],
  },
  {
    slug: 'api-and-webhooks',
    title: 'API keys and webhooks',
    category: 'account',
    summary: 'Integrate Bracket with your own tools.',
    keywords: ['api', 'key', 'webhook', 'developer', 'integration'],
    sections: [
      {
        heading: 'API keys',
        body: ['Create keys in Developer with scoped permissions. Send them as a Bearer token to the REST API documented at /api-docs.'],
      },
      {
        heading: 'Webhooks',
        body: ['Register an HTTPS endpoint and choose events (match completed, registration created, tournament completed…). Payloads are signed; failed deliveries are retried and logged.'],
      },
    ],
  },

  // ---------------------------------------------------------------- troubleshooting
  {
    slug: 'deleting-and-recovering',
    title: 'Deleting, resetting and recovering a tournament',
    category: 'troubleshooting',
    summary: 'Undo a generated bracket, fix a wrong result or delete for good.',
    keywords: ['delete', 'reset', 'undo', 'recover', 'wrong result'],
    sections: [
      {
        heading: 'Fixing a wrong result',
        body: ['Open the match and edit the score. Downstream matches are updated automatically as long as later results are not affected; otherwise you are asked to confirm which results to clear.'],
      },
      {
        heading: 'Resetting the bracket',
        body: ['Reset (Settings → Advanced) removes all matches and standings but keeps participants and settings, so you can regenerate.'],
      },
      {
        heading: 'Deleting and recovery',
        body: ['Delete removes the tournament and its public page. Contact support within 14 days if you need it restored.'],
      },
    ],
  },
  {
    slug: 'live-updates-not-showing',
    title: 'Live updates are not showing',
    category: 'troubleshooting',
    summary: 'What to check when scores do not appear for viewers.',
    keywords: ['live', 'realtime', 'offline', 'refresh', 'websocket'],
    sections: [
      {
        heading: 'Check the live indicator',
        body: ['The header shows Live when the page is connected. If it shows Offline, the browser could not open a WebSocket — common on restrictive venue Wi-Fi. The page still refreshes data periodically.'],
      },
      {
        heading: 'Embeds and TV mode',
        body: ['Embeds reconnect automatically. If a TV has been showing the page for many hours, reload it once a day.'],
      },
    ],
  },
  {
    slug: 'status',
    title: 'Service status',
    category: 'troubleshooting',
    summary: 'Where to check for outages and maintenance.',
    keywords: ['status', 'outage', 'maintenance', 'down'],
    sections: [
      {
        heading: 'Current status',
        body: ['All systems are operational unless noted here. Planned maintenance is announced at least 24 hours ahead on this page and in the in-app inbox.'],
      },
      {
        heading: 'Reporting a problem',
        body: ['If something looks broken, contact us with the tournament link, the time it happened and a screenshot.'],
      },
    ],
  },
];

export function getArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function articlesInCategory(category: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === category);
}

export function categoryOf(id: HelpCategoryId): HelpCategory {
  return HELP_CATEGORIES.find((c) => c.id === id)!;
}

export function searchArticles(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELP_ARTICLES;
  const terms = q.split(/\s+/);
  return HELP_ARTICLES.map((a) => {
    const hay = [
      a.title,
      a.summary,
      ...(a.keywords ?? []),
      ...a.sections.flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.bullets ?? [])]),
    ]
      .join(' ')
      .toLowerCase();
    const score = terms.reduce((acc, t) => {
      if (a.title.toLowerCase().includes(t)) return acc + 5;
      if ((a.keywords ?? []).some((k) => k.includes(t))) return acc + 3;
      if (hay.includes(t)) return acc + 1;
      return acc;
    }, 0);
    return { a, score };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}
