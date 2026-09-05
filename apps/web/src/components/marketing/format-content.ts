import type { PreviewFormat } from './generate-preview';

export type FormatSlug =
  | 'single-elimination'
  | 'double-elimination'
  | 'round-robin'
  | 'swiss'
  | 'groups-knockout'
  | 'free-for-all'
  | 'leaderboard'
  | 'racing';

export type FormatPage = {
  slug: FormatSlug;
  preview: PreviewFormat;
  /** TournamentFormat used for /tournaments/new?format=… */
  apiFormat: string;
  name: string;
  tagline: string;
  intro: string;
  howItWorks: string[];
  whenToUse: string[];
  math: { formula: string; explanation: string; example: string };
  faq: { q: string; a: string }[];
  keywords: string[];
};

export const FORMAT_PAGES: FormatPage[] = [
  {
    slug: 'single-elimination',
    preview: 'SINGLE_ELIMINATION',
    apiFormat: 'SINGLE_ELIMINATION',
    name: 'Single elimination',
    tagline: 'Lose once and you are out.',
    intro:
      'The classic knockout tree. Fast, simple to follow and easy to schedule — the default for cups, playoffs and one-day events.',
    howItWorks: [
      'Participants are seeded into a bracket sized to the next power of two (4, 8, 16, 32…). Top seeds receive byes when the field is not a power of two.',
      'Winners advance to the next round; losers are eliminated. The last remaining participant is the champion.',
      'Optionally add a third-place match between semi-final losers, or placement ladders to rank every participant.',
    ],
    whenToUse: [
      'Limited time or venue capacity.',
      'Large fields (32+) where round robin is impossible.',
      'Playoffs after a league stage.',
      'Spectator events — every match is do-or-die.',
    ],
    math: {
      formula: 'n − 1',
      explanation: 'Every match eliminates exactly one participant, and n − 1 must be eliminated to leave one champion. Add 1 for a third-place match.',
      example: '16 participants → 15 matches (16 with a bronze final); 13 participants → 12 matches with 3 first-round byes.',
    },
    faq: [
      { q: 'What happens with an odd number of participants?', a: 'The bracket is sized up to the next power of two and the highest seeds receive byes in round one.' },
      { q: 'Can I play best-of series?', a: 'Yes — set knockout best-of to 3, 5 or 7 and results are validated per series.' },
      { q: 'Can I have a third-place match?', a: 'Yes. Enable it in settings before generating; you can also run full placement ladders.' },
    ],
    keywords: ['single elimination bracket', 'knockout tournament', 'bracket generator', 'byes'],
  },
  {
    slug: 'double-elimination',
    preview: 'DOUBLE_ELIMINATION',
    apiFormat: 'DOUBLE_ELIMINATION',
    name: 'Double elimination',
    tagline: 'Everyone gets a second chance.',
    intro:
      'Two brackets: winners and losers. A single loss drops you to the lower bracket; a second loss sends you home. The lower-bracket champion meets the upper-bracket champion in the grand final.',
    howItWorks: [
      'Round one is played in the winners bracket. Losers drop into the losers bracket, where they meet other losers from later winners rounds.',
      'Losers-bracket rounds alternate between "drop-down" rounds (new losers arrive) and "consolidation" rounds.',
      'The grand final pits the winners champion against the losers champion. With bracket reset enabled, a losers-side win forces one deciding match.',
    ],
    whenToUse: [
      'Fighting games, esports and any event where a single upset should not end a run.',
      'Fields of 8–64 with a full day available.',
      'When you want an accurate 1st–3rd placement.',
    ],
    math: {
      formula: '2n − 2 (or 2n − 1 with reset)',
      explanation: 'Each participant except the champion loses exactly twice, so there are 2(n − 1) losses = matches. The optional bracket reset adds one.',
      example: '16 participants → 30 matches, 31 if the reset is played. Roughly double single elimination.',
    },
    faq: [
      { q: 'What is a bracket reset?', a: 'If the losers-bracket champion beats the winners-bracket champion in the grand final, both have one loss. The reset is a final deciding match.' },
      { q: 'Can some players start in the losers bracket?', a: 'Yes — enable split participants to seed part of the field directly into the lower bracket.' },
      { q: 'Is there a third-place match?', a: 'Not needed: the losers-bracket final loser is third by construction.' },
    ],
    keywords: ['double elimination bracket', 'losers bracket', 'grand final', 'bracket reset'],
  },
  {
    slug: 'round-robin',
    preview: 'ROUND_ROBIN',
    apiFormat: 'ROUND_ROBIN',
    name: 'Round robin',
    tagline: 'Everyone plays everyone.',
    intro:
      'The fairest format for small fields. Every participant meets every other participant once (or twice), and the table is ranked by points and tiebreakers.',
    howItWorks: [
      'Matches are scheduled with the circle method so each round has every participant playing once (one sits out if the field is odd).',
      'Points are awarded per result (e.g. 3-1-0). Standings are ranked by points, then by your ordered tiebreakers: head-to-head, score difference, score for, and more.',
      'Optionally play a double round robin with home and away legs.',
    ],
    whenToUse: [
      'Leagues and small groups of 4–10.',
      'When maximum fairness matters more than speed.',
      'Seeding a knockout stage — see groups + knockout.',
    ],
    math: {
      formula: 'n(n − 1) / 2 × meetings',
      explanation: 'Each of the n participants plays the other n − 1; dividing by two avoids counting each pairing twice. Multiply by the number of meetings for double round robin.',
      example: '6 participants → 15 matches over 5 rounds; 10 participants → 45 matches; double round robin with 8 → 56 matches.',
    },
    faq: [
      { q: 'How are ties in the table broken?', a: 'By the criteria you order in settings — head-to-head, score difference, score for, sets, fair play, even a recorded draw of lots.' },
      { q: 'Can I run a round robin with 20 participants?', a: 'You can, but that is 190 matches. Consider Swiss or groups + knockout.' },
    ],
    keywords: ['round robin schedule', 'league table', 'everyone plays everyone', 'tiebreakers'],
  },
  {
    slug: 'swiss',
    preview: 'SWISS',
    apiFormat: 'SWISS',
    name: 'Swiss system',
    tagline: 'Big fields, few rounds, no eliminations.',
    intro:
      'A fixed number of rounds where each round pairs participants with similar records. Nobody is eliminated, nobody plays the same opponent twice, and a clear winner emerges in about log₂(n) rounds.',
    howItWorks: [
      'Round one pairs by seed (top half vs bottom half). After each round, participants are grouped by score and paired within their group, avoiding rematches.',
      'FIDE Dutch mode also balances home/away or colour assignments.',
      'Final standings use points, then Buchholz, Median Buchholz or Sonneborn-Berger tiebreakers.',
    ],
    whenToUse: [
      'Chess, card games, tabletop and esports opens with 16–500 players.',
      'When everyone should play every round.',
      'Qualifiers that cut to a top-8 knockout.',
    ],
    math: {
      formula: '⌈log₂ n⌉ rounds × ⌊n / 2⌋ matches',
      explanation: 'Each round has n/2 matches. Running log₂(n) rounds guarantees at most one undefeated participant.',
      example: '32 participants → 5 rounds of 16 matches = 80 matches (vs 496 for round robin).',
    },
    faq: [
      { q: 'What is Buchholz?', a: 'The sum of your opponents’ scores — a measure of strength of schedule. Higher is better.' },
      { q: 'Can I pre-generate all rounds?', a: 'Use Pots mode (UCL style) to fix fixtures up front; classic mode pairs after each round.' },
    ],
    keywords: ['swiss tournament', 'swiss pairing', 'buchholz', 'chess tournament'],
  },
  {
    slug: 'groups-knockout',
    preview: 'GROUPS_KNOCKOUT',
    apiFormat: 'GROUPS_KNOCKOUT',
    name: 'Groups + knockout',
    tagline: 'World-Cup style two-stage tournament.',
    intro:
      'Round robin groups guarantee everyone several matches; the top finishers advance to a knockout bracket seeded across groups so group winners avoid each other early.',
    howItWorks: [
      'Draw participants into groups by serpentine seeding, UEFA-style pots or random. Optionally run a live, auditable draw ceremony.',
      'Each group plays round robin. Standings use your configured tiebreakers.',
      'The top N per group (plus optional best third-placed teams) advance; the knockout bracket is seeded so 1st-place teams meet 2nd-place teams from other groups.',
    ],
    whenToUse: [
      'Football, futsal, basketball and volleyball tournaments.',
      'Fields of 8–48 where you want guaranteed games and a dramatic finish.',
      'Multi-day events: groups on day one, knockout on day two.',
    ],
    math: {
      formula: 'Σ k(k − 1)/2 + (g·a − 1)',
      explanation: 'Group matches are round robin within each group of size k; the knockout has g × a advancers and needs one fewer match than participants.',
      example: '16 teams in 4 groups of 4, top 2 advance → 24 group matches + 7 knockout matches = 31 (32 with a bronze final).',
    },
    faq: [
      { q: 'How do best third-placed teams work?', a: 'Third-placed teams across groups are ranked together and the best few fill the remaining bracket spots — e.g. 6 groups × 2 + 4 thirds = 16.' },
      { q: 'Can groups be two-legged?', a: 'Yes, both group and knockout matches can be home and away with aggregate scoring.' },
    ],
    keywords: ['group stage', 'two stage tournament', 'world cup format', 'groups then knockout'],
  },
  {
    slug: 'free-for-all',
    preview: 'FREE_FOR_ALL',
    apiFormat: 'FREE_FOR_ALL',
    name: 'Free for all',
    tagline: 'Placement-based events for many players at once.',
    intro:
      'For games where more than two participants compete at the same time: battle royale, party games, heats and open placement boards. Rank by finishing position and points.',
    howItWorks: [
      'All participants take part in one or more events (lobbies, heats, rounds).',
      'Enter each participant’s placement per event; placement points are awarded from a configurable table.',
      'The board ranks participants by total points with placement-based tiebreakers.',
    ],
    whenToUse: ['Battle royale and party-game nights.', 'Athletics heats and finals.', 'Any event without head-to-head matches.'],
    math: {
      formula: 'placement → points',
      explanation: 'Points are a function of finishing position (e.g. 1st = 10, 2nd = 8 …) summed across events.',
      example: '20 players, 3 lobbies → 3 placement entries each, one leaderboard.',
    },
    faq: [
      { q: 'Can I customise placement points?', a: 'Yes, sport presets provide defaults (e.g. battle royale) and you can edit the table.' },
    ],
    keywords: ['free for all tournament', 'battle royale points', 'placement leaderboard'],
  },
  {
    slug: 'leaderboard',
    preview: 'LEADERBOARD',
    apiFormat: 'LEADERBOARD',
    name: 'Leaderboard',
    tagline: 'Several scoring events, one cumulative table.',
    intro:
      'Run a series of scoring events — rounds, games, challenges — and keep a running total. Perfect for seasons, ladders and multi-event competitions.',
    howItWorks: [
      'Create as many events as you need. Each event records a score or points per participant.',
      'The leaderboard sums points across events and ranks participants, with best-single-event and most-wins tiebreakers.',
      'Events can be added over time — the board updates live.',
    ],
    whenToUse: ['Season-long ladders.', 'Skills challenges and multi-game nights.', 'Fantasy-style or prediction contests.'],
    math: {
      formula: 'Σ event points',
      explanation: 'Total = sum of points across all events a participant took part in.',
      example: '12 players, 6 weekly events → one table that tells the season story.',
    },
    faq: [
      { q: 'Can I drop the worst result?', a: 'Not yet — export to CSV to apply custom scoring, or contact us with your use case.' },
    ],
    keywords: ['leaderboard tournament', 'season points table', 'cumulative scoring'],
  },
  {
    slug: 'racing',
    preview: 'RACING',
    apiFormat: 'SINGLE_RACE',
    name: 'Racing formats',
    tagline: 'Time trials, single races and Grand Prix series.',
    intro:
      'Three formats for anything with a finish line: a time trial ranks by fastest time, a single race ranks by finishing order, and a Grand Prix sums F1-style points across multiple races.',
    howItWorks: [
      'Time trial: each participant posts a time; fastest wins.',
      'Single race: enter the finishing order; the result is the ranking.',
      'Grand Prix: several races, each awarding 25-18-15-12-10-8-6-4-2-1 points; the championship table is the sum.',
    ],
    whenToUse: ['Karting, cycling, running and sim racing.', 'Track and field time-based events.', 'Any season with multiple heats.'],
    math: {
      formula: 'best time · finish order · Σ race points',
      explanation: 'No head-to-head matches — every event produces a full ranking directly.',
      example: '10 drivers, 5 races → 50 results, one championship standing.',
    },
    faq: [
      { q: 'Can I change the points table?', a: 'Yes, the F1 default can be edited per tournament.' },
    ],
    keywords: ['time trial results', 'grand prix points', 'race series standings'],
  },
];

export function getFormatPage(slug: string): FormatPage | undefined {
  return FORMAT_PAGES.find((f) => f.slug === slug);
}
