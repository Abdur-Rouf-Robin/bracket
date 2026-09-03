'use client';

import Link from 'next/link';
import { BracketView, StandingsTable } from '@/components/bracket-view';
import { BracketPredictionsPanel } from '@/components/bracket-predictions-panel';
import { MatchEntryBoard } from '@/components/match-entry-board';
import { ParticipantsPanel } from '@/components/participants-panel';
import {
  AllPlayersView,
  PlayersByTeamView,
} from '@/components/players-directory-view';
import { PlayerPerformanceTable } from '@/components/tournament-performance-view';
import { TeamRostersView } from '@/components/team-rosters-view';
import { TournamentMatchesView } from '@/components/tournament-matches-view';
import { TournamentOverviewSection } from '@/components/tournament-overview-section';
import { TournamentStatsSection } from '@/components/tournament-performance-view';
import { TeamRosterPanel } from '@/components/team-roster-panel';
import { TournamentVenuePanel } from '@/components/tournament-venue-panel';
import { TournamentSettingsPanel } from '@/components/tournament-settings-panel';
import { TournamentMediaPanel } from '@/components/tournament-media-panel';
import { TournamentToolsPanel } from '@/components/tournament-tools-panel';
import { SymmetricalBracket } from '@/components/symmetrical-bracket/symmetrical-bracket';
import type { MainTab } from '@/lib/tournament-nav';
import { hasKnockoutPhase, knockoutMatches } from '@/lib/tournament-stats';
import type { Tournament } from '@/lib/types';
import type {
  ShareCardPayload,
  TournamentMvpRow,
} from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EVENT_FORMATS = new Set([
  'TIME_TRIAL',
  'SINGLE_RACE',
  'GRAND_PRIX',
  'LEADERBOARD',
]);

type ManageExtras = {
  token: string;
  slug: string;
  eventKey: string;
  setEventKey: (v: string) => void;
  eventValues: Record<string, string>;
  setEventValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveEvent: () => void;
  eventPending: boolean;
  onSharePrematch: (matchId: string) => void;
  onShareResult: (matchId: string) => void;
  onShareCard: (matchId: string) => void;
};

export function TournamentTabContent({
  tournament,
  tab,
  sub,
  mode,
  basePath,
  mvpRows,
  token,
  userId,
  onCheckInSelf,
  manage,
}: {
  tournament: Tournament;
  tab: MainTab;
  sub: string;
  mode: 'public' | 'manage';
  basePath: string;
  mvpRows: TournamentMvpRow[];
  token?: string;
  userId?: string;
  onCheckInSelf?: () => void;
  manage?: ManageExtras;
}) {
  const settings = tournament.settings as
    | {
        enableMvp?: boolean;
        showStandings?: boolean;
        showAnnouncementTab?: boolean;
        hideBracketPreviewPublic?: boolean;
      }
    | undefined;

  const showMvp = settings?.enableMvp !== false;
  const showStandings = settings?.showStandings !== false;
  const showAnnouncements = settings?.showAnnouncementTab !== false;
  const hasKnockout = hasKnockoutPhase(tournament);
  const entryToken =
    mode === 'manage' && manage?.token ? manage.token : token;
  const canEnterResults =
    !!tournament.canManage &&
    !!entryToken &&
    !!tournament.format &&
    !EVENT_FORMATS.has(tournament.format);

  switch (tab) {
    case 'overview':
      return (
        <div className="space-y-8">
          <TournamentOverviewSection
            tournament={tournament}
            mvpRows={mvpRows}
            basePath={basePath}
            showStandings={showStandings}
            showAnnouncements={showAnnouncements}
          />
          {token && (
            <BracketPredictionsPanel tournament={tournament} token={token} />
          )}
        </div>
      );

    case 'teams':
      if (sub === 'rosters') {
        return <TeamRostersView tournament={tournament} />;
      }
      if (sub === 'team-settings' && mode === 'manage' && token) {
        return (
          <div className="space-y-8">
            <section>
              <h2 className="font-display text-lg font-semibold">
                Hosting & venue
              </h2>
              <div className="mt-3">
                <TournamentVenuePanel
                  tournament={tournament}
                  token={token}
                  embedded
                />
              </div>
            </section>
            <section>
              <h2 className="font-display text-lg font-semibold">
                Rosters & images
              </h2>
              <div className="mt-3">
                <TeamRosterPanel
                  tournament={tournament}
                  token={token}
                  embedded
                />
              </div>
            </section>
          </div>
        );
      }
      return (
        <ParticipantsPanel
          tournament={tournament}
          token={token}
          canManage={tournament.canManage}
          slug={tournament.slug}
          userId={userId}
          onCheckInSelf={onCheckInSelf}
        />
      );

    case 'players':
      switch (sub) {
        case 'by-team':
          return <PlayersByTeamView tournament={tournament} />;
        case 'performance':
          return (
            <PlayerPerformanceTable
              rows={showMvp ? mvpRows : []}
            />
          );
        case 'edit':
          if (mode === 'manage' && token) {
            return (
              <TeamRosterPanel
                tournament={tournament}
                token={token}
                embedded
              />
            );
          }
          return <AllPlayersView tournament={tournament} />;
        case 'all':
        default:
          return <AllPlayersView tournament={tournament} />;
      }

    case 'bracket':
      if (tournament.previewHidden && mode === 'public') {
        return (
          <p className="gaming-card rounded-xl border-dashed p-6 text-[var(--color-muted)]">
            Bracket preview is hidden for the public until the host reveals it.
          </p>
        );
      }
      if (sub === 'knockout' && hasKnockout) {
        const ko = knockoutMatches(tournament);
        if (!ko.length) {
          return (
            <p className="text-sm text-[var(--color-muted)]">
              Knockout stage not started yet.
            </p>
          );
        }
        return (
          <div className="space-y-8">
            <SymmetricalBracket
              tournament={{
                ...tournament,
                matches: ko,
                format:
                  tournament.format === 'GROUPS_KNOCKOUT'
                    ? 'SINGLE_ELIMINATION'
                    : tournament.format,
              }}
            />
            <section>
              <h3 className="font-display text-lg font-semibold">
                Knockout matches
              </h3>
              <div className="mt-3">
                <TournamentMatchesView
                  tournament={tournament}
                  knockoutOnly
                  token={entryToken}
                  slug={tournament.slug}
                  canEnterResults={canEnterResults}
                />
              </div>
            </section>
          </div>
        );
      }
      return <BracketView tournament={tournament} />;

    case 'matches': {
      const scheduleView = (
        <TournamentMatchesView
          tournament={tournament}
          token={entryToken}
          slug={tournament.slug}
          canEnterResults={canEnterResults}
        />
      );

      if (mode === 'manage' && manage?.token && canEnterResults) {
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Enter match results
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                Tap a team to advance the winner, or enter scores on each match
                below.
              </p>
            </div>

            {tournament.format && EVENT_FORMATS.has(tournament.format) && (
              <EventResultsForm tournament={tournament} manage={manage} />
            )}

            <MatchEntryBoard
              tournament={tournament}
              token={manage.token}
              slug={manage.slug}
              defaultFilter="pending"
              onSharePrematch={manage.onSharePrematch}
              onShareResult={manage.onShareResult}
              onShareCard={manage.onShareCard}
            />
            <section>
              <h3 className="font-display text-lg font-semibold">
                Full schedule
              </h3>
              <div className="mt-3">{scheduleView}</div>
            </section>
          </div>
        );
      }

      if (canEnterResults && entryToken) {
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Enter match results
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                Each upcoming match below has score fields — fill them in and
                click <strong>Save result</strong>. TBD slots cannot be scored
                yet.
              </p>
            </div>
            {scheduleView}
          </div>
        );
      }

      if (tournament.canManage && !entryToken) {
        return (
          <div className="space-y-4">
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
              <Link href="/login" className="font-semibold underline">
                Log in
              </Link>{' '}
              as the tournament host to enter match results on this page.
            </p>
            {scheduleView}
          </div>
        );
      }

      return scheduleView;
    }

    case 'standings':
      if (!showStandings) {
        return (
          <p className="text-sm text-[var(--color-muted)]">
            Standings are hidden for this tournament.
          </p>
        );
      }
      return <StandingsTable tournament={tournament} />;

    case 'stats':
      return (
        <TournamentStatsSection
          tournament={tournament}
          mvpRows={showMvp ? mvpRows : []}
          sub={sub || 'teams'}
        />
      );

    case 'settings':
      if (mode !== 'manage' || !token || !tournament.canManage) {
        return null;
      }
      switch (sub) {
        case 'rosters':
          return (
            <TeamRosterPanel tournament={tournament} token={token} embedded />
          );
        case 'tournament':
          return tournament.isOwner ? (
            <TournamentSettingsPanel
              tournament={tournament}
              token={token}
              embedded
            />
          ) : null;
        case 'media':
          return tournament.isOwner ? (
            <TournamentMediaPanel tournament={tournament} token={token} />
          ) : null;
        case 'tools':
          return (
            <TournamentToolsPanel
              tournament={tournament}
              token={token}
              embedded
            />
          );
        case 'venue':
        default:
          return (
            <TournamentVenuePanel
              tournament={tournament}
              token={token}
              embedded
            />
          );
      }

    default:
      return null;
  }
}

function EventResultsForm({
  tournament,
  manage,
}: {
  tournament: Tournament;
  manage: ManageExtras;
}) {
  return (
    <div className="panel-card space-y-4 rounded-xl p-4">
      <div>
        <Label>Event</Label>
        <select
          className="panel-card field-select mt-1"
          value={manage.eventKey}
          onChange={(e) => manage.setEventKey(e.target.value)}
        >
          {[
            ...new Map(
              (tournament.eventResults ?? []).map((r) => [
                r.eventKey,
                r.eventLabel,
              ]),
            ),
          ].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        {(tournament.eventResults ?? [])
          .filter((r) => r.eventKey === manage.eventKey)
          .map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-sm font-medium">
                {r.team.name}
              </span>
              <Input
                type="number"
                min={0}
                step="any"
                value={manage.eventValues[r.teamId] ?? ''}
                onChange={(e) =>
                  manage.setEventValues((prev) => ({
                    ...prev,
                    [r.teamId]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
      </div>
      <Button disabled={manage.eventPending} onClick={manage.onSaveEvent}>
        Save event results
      </Button>
    </div>
  );
}
