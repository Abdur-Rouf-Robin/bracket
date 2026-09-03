'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  applyFormatPlan,
  applyGameProfile,
  COUNTRY_OPTIONS,
  DEFAULT_TOURNAMENT_SETTINGS,
  FINAL_STAGE_OPTIONS,
  mvpWeightsSchema,
  profileForGameName,
  RANK_BY_OPTIONS,
  resolveGameProfile,
  SINGLE_STAGE_OPTIONS,
  type FormatPlan,
  type TournamentSettings,
} from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { FormatSuggestionPicker, GameRulesSummary } from '@/components/format-suggestion-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BulkTeamInput } from '@/components/bulk-team-input';
import { PredictionCustomFieldsEditor } from '@/components/prediction-custom-fields-editor';
import { ImageUrlField } from '@/components/image-url-field';
import { SHARE_IMAGE_ASSET_SPECS } from '@bracket/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';

type Step = 'basics' | 'count' | 'format' | 'rules' | 'registration' | 'teams';

type Game = { id: string; name: string; category: string };

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="panel-card flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[var(--color-muted)]">{hint}</span>
        )}
      </span>
    </label>
  );
}

export default function NewTournamentPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('basics');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [gameId, setGameId] = useState('');
  const [pointsWin, setPointsWin] = useState(3);
  const [pointsDraw, setPointsDraw] = useState(1);
  const [isPublic, setIsPublic] = useState(true);
  const [startAt, setStartAt] = useState('');
  const [venueType, setVenueType] = useState<'ONLINE' | 'PHYSICAL' | ''>('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueUrl, setVenueUrl] = useState('');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [settings, setSettings] = useState<TournamentSettings>({
    ...DEFAULT_TOURNAMENT_SETTINGS,
  });

  const [teamCount, setTeamCount] = useState(8);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FormatPlan | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<string[][]>([]);

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<Game[]>('/games'),
  });

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    setTeamNames((prev) =>
      Array.from({ length: teamCount }, (_, i) => prev[i] ?? `Team ${i + 1}`),
    );
    setTeamPlayers((prev) =>
      Array.from({ length: teamCount }, (_, i) => {
        const existing = prev[i] ?? [];
        const minRows = settings.requireTeamRegistration
          ? settings.playersPerTeam
          : settings.playersPerTeam > 1
            ? settings.playersPerTeam
            : 0;
        if (existing.length >= minRows) return existing;
        return Array.from(
          { length: minRows },
          (_, p) => existing[p] ?? '',
        );
      }),
    );
  }, [teamCount, settings.requireTeamRegistration, settings.playersPerTeam]);

  function addPlayerRow(teamIndex: number) {
    setTeamPlayers((prev) => {
      const next = prev.map((row) => [...row]);
      while (next.length <= teamIndex) next.push([]);
      next[teamIndex] = [...(next[teamIndex] ?? []), ''];
      return next;
    });
  }

  function removePlayerRow(teamIndex: number, playerIndex: number) {
    setTeamPlayers((prev) => {
      const next = prev.map((row) => [...row]);
      next[teamIndex] = (next[teamIndex] ?? []).filter((_, j) => j !== playerIndex);
      return next;
    });
  }

  useEffect(() => {
    if (!slug && name) {
      setSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      );
    }
  }, [name, slug]);

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/t/${slug || 'your-slug'}`;
    return `${window.location.origin}/t/${slug || 'your-slug'}`;
  }, [slug]);

  const selectedGame = games.find((g) => g.id === gameId);
  const gameProfile = useMemo(
    () => resolveGameProfile({ gameName: selectedGame?.name }),
    [selectedGame?.name],
  );

  const stepIndex =
    step === 'basics'
      ? 1
      : step === 'count'
        ? 2
        : step === 'format'
          ? 3
          : step === 'rules'
            ? 4
            : step === 'registration'
              ? 5
              : 6;

  function patchSettings(partial: Partial<TournamentSettings>) {
    setSettings((s) => ({ ...s, ...partial }));
  }

  function onGameChange(id: string) {
    setGameId(id);
    const game = games.find((g) => g.id === id);
    if (!game) return;
    const profile = profileForGameName(game.name);
    if (!profile) return;
    const applied = applyGameProfile(profile);
    setSettings(applied.settings);
    setPointsWin(applied.pointsWin);
    setPointsDraw(applied.pointsDraw);
  }

  async function saveBasics() {
    if (!token || !name.trim()) return;
    setPending(true);
    setError('');
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        slug: slug.trim() || undefined,
        gameId: gameId || null,
        isPublic,
        pointsWin,
        pointsDraw,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        venueType: venueType || null,
        venueName: venueName.trim() || null,
        venueAddress: venueAddress.trim() || null,
        venueUrl: venueUrl.trim() || null,
        backgroundImageUrl: backgroundImageUrl.trim() || null,
        logoUrl: logoUrl.trim() || null,
        settings,
      };
      const t = tournament
        ? await api<Tournament>(`/tournaments/${tournament.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify(body),
          })
        : await api<Tournament>('/tournaments', {
            method: 'POST',
            token,
            body: JSON.stringify(body),
          });
      setTournament(t);
      setSlug(t.slug);
      setStep('count');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  async function saveRules() {
    if (!token || !tournament) return;
    setPending(true);
    setError('');
    try {
      const t = await api<Tournament>(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ settings }),
      });
      setTournament(t);
      setStep('registration');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  async function saveRegistration() {
    if (!token || !tournament) return;
    setPending(true);
    setError('');
    try {
      const t = await api<Tournament>(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ settings }),
      });
      setTournament(t);
      setTeamCount(Math.min(teamCount, settings.maxParticipants));
      setStep('teams');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  async function finish() {
    if (!token || !tournament) return;
    setPending(true);
    setError('');
    try {
      const useGroups = settings.stageMode === 'TWO_STAGE';
      const gCount =
        selectedPlan?.groupCount && selectedPlan.groupCount > 0
          ? selectedPlan.groupCount
          : Math.max(2, Math.ceil(teamCount / settings.participantsPerGroup));
      const groupNames = Array.from({ length: gCount }, (_, i) =>
        `Group ${String.fromCharCode(65 + i)}`,
      );

      await api(`/tournaments/${tournament.id}/teams`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          teams: teamNames.map((n, i) => ({
            name: n.trim() || `Team ${i + 1}`,
            ...(useGroups
              ? { groupName: groupNames[i % groupNames.length] }
              : {}),
            ...(settings.requireTeamRegistration
              ? {
                  players: (teamPlayers[i] ?? [])
                    .map((p) => p.trim())
                    .filter(Boolean),
                }
              : {
                  players: (teamPlayers[i] ?? [])
                    .map((p) => p.trim())
                    .filter(Boolean),
                }),
          })),
        }),
      });

      const format =
        settings.stageMode === 'TWO_STAGE'
          ? 'GROUPS_KNOCKOUT'
          : settings.singleStageFormat;

      const t = await api<Tournament>(`/tournaments/${tournament.id}/generate`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          format,
          useSavedSettings: true,
          groupCount: useGroups ? gCount : undefined,
          advancePerGroup: settings.advancePerGroup,
          swissRounds: settings.swissRounds,
          raceCount: settings.raceCount,
          eventCount: settings.eventCount,
        }),
      });
      router.push(`/t/${t.slug}/manage`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  const gamesByCategory = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of games) {
      if (!map.has(g.category)) map.set(g.category, []);
      map.get(g.category)!.push(g);
    }
    return [...map.entries()];
  }, [games]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-8 text-[var(--color-muted)]">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-8 text-[var(--color-muted)]">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                n <= stepIndex
                  ? 'bg-[var(--color-accent)]'
                  : 'bg-[var(--color-line)]'
              }`}
            />
          ))}
        </div>

        <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Step {stepIndex} of 6
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {step === 'basics' && 'Tournament details'}
          {step === 'count' && 'How many teams?'}
          {step === 'format' && 'Pick a format'}
          {step === 'rules' && 'Game rules & ranking'}
          {step === 'registration' && 'Registration & advanced'}
          {step === 'teams' && 'Participants'}
        </h1>

        {step === 'basics' && (
          <div className="panel-card mt-8 space-y-4 rounded-2xl p-6">
            <div>
              <Label>Tournament name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                className="field-textarea mt-1 min-h-[90px] outline-none ring-[var(--color-accent)] focus:ring-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this tournament about?"
              />
            </div>
            <div>
              <Label>Game</Label>
              <Select
                className="mt-1"
                value={gameId}
                onChange={onGameChange}
                placeholder="Select a game…"
                groups={gamesByCategory.map(([category, list]) => ({
                  label: category,
                  options: list.map((g) => ({ value: g.id, label: g.name })),
                }))}
              />
            </div>
            <div>
              <Label>Public URL slug</Label>
              <div className="mt-1 flex items-center gap-2">
                <span className="shrink-0 text-xs text-[var(--color-muted)]">
                  /t/
                </span>
                <Input
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, ''),
                    )
                  }
                  placeholder="spring-cup-2026"
                />
              </div>
              <p className="mt-1 break-all text-xs text-[var(--color-muted)]">
                Full URL: {publicUrl}
              </p>
            </div>
            <div>
              <Label>Start time</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="border-t border-[var(--color-line)] pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Hosting & venue (optional)
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ['', 'Not set'],
                    ['ONLINE', 'Online'],
                    ['PHYSICAL', 'Physical field / venue'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value || 'none'}
                    type="button"
                    onClick={() => setVenueType(value)}
                    className={`rounded-xl px-3 py-2 text-left text-sm ${
                      venueType === value ? 'choice-btn-active' : 'choice-btn'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {venueType === 'ONLINE' && (
                <div className="mt-3 space-y-3">
                  <div>
                    <Label>Platform (optional)</Label>
                    <Input
                      className="mt-1"
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      placeholder="Discord, Twitch…"
                    />
                  </div>
                  <div>
                    <Label>Link or room code</Label>
                    <Input
                      className="mt-1"
                      value={venueUrl}
                      onChange={(e) => setVenueUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                </div>
              )}
              {venueType === 'PHYSICAL' && (
                <div className="mt-3 space-y-3">
                  <div>
                    <Label>Venue / field name</Label>
                    <Input
                      className="mt-1"
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Address (optional)</Label>
                    <Input
                      className="mt-1"
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            <Toggle
              checked={isPublic}
              onChange={setIsPublic}
              label="Public tournament page"
              hint="Anyone with the link can open /t/your-slug"
            />
            <div className="border-t border-[var(--color-line)] pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Share image assets (optional)
              </p>
              <div className="space-y-4">
                <ImageUrlField
                  label={SHARE_IMAGE_ASSET_SPECS.tournament.backgroundImageUrl.label}
                  hint={SHARE_IMAGE_ASSET_SPECS.tournament.backgroundImageUrl.minSize}
                  value={backgroundImageUrl}
                  onChange={setBackgroundImageUrl}
                  token={token ?? undefined}
                />
                <ImageUrlField
                  label={SHARE_IMAGE_ASSET_SPECS.tournament.logoUrl.label}
                  value={logoUrl}
                  onChange={setLogoUrl}
                  token={token ?? undefined}
                />
              </div>
            </div>
            <Button disabled={pending || !name.trim()} onClick={saveBasics}>
              Continue
            </Button>
          </div>
        )}

        {step === 'count' && (
          <div className="panel-card mt-8 space-y-4 rounded-2xl p-6">
            <GameRulesSummary profile={gameProfile} />
            <div>
              <Label>Number of teams / clans</Label>
              <Input
                type="number"
                min={2}
                max={128}
                className="mt-1 max-w-[160px] text-lg font-bold"
                value={teamCount}
                onChange={(e) => {
                  const n = Math.max(2, Math.min(128, Number(e.target.value) || 2));
                  setTeamCount(n);
                  setSelectedPlanId(null);
                  setSelectedPlan(null);
                }}
              />
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Enter your team count first — we&apos;ll only show formats that work for{' '}
                {teamCount} teams (including 7, 9, 14, etc.).
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('basics')}>
                Back
              </Button>
              <Button disabled={teamCount < 2} onClick={() => setStep('format')}>
                See format options
              </Button>
            </div>
          </div>
        )}

        {step === 'format' && (
          <div className="panel-card mt-8 space-y-4 rounded-2xl p-6">
            <FormatSuggestionPicker
              teamCount={teamCount}
              gameName={selectedGame?.name}
              selectedId={selectedPlanId ?? undefined}
              onSelect={(plan) => {
                setSelectedPlanId(plan.id);
                setSelectedPlan(plan);
                setSettings((s) => applyFormatPlan(plan, s));
              }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('count')}>
                Back
              </Button>
              <Button
                disabled={!selectedPlanId}
                onClick={() => setStep('rules')}
              >
                Continue with this format
              </Button>
            </div>
          </div>
        )}

        {step === 'rules' && (
          <div className="mt-8 space-y-6">
            <GameRulesSummary profile={gameProfile} />
            {selectedPlan && (
              <p className="rounded-xl bg-[var(--color-accent)]/10 px-4 py-3 text-sm">
                <strong>{selectedPlan.label}</strong> — {selectedPlan.detail}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['SINGLE', 'Single stage'],
                  ['TWO_STAGE', 'Two stage'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => patchSettings({ stageMode: value })}
                  className={`rounded-2xl px-4 py-4 text-left ${
                    settings.stageMode === value
                      ? 'choice-btn-active'
                      : 'choice-btn'
                  }`}
                >
                  <p className="font-semibold">{label}</p>
                </button>
              ))}
            </div>

            {settings.stageMode === 'SINGLE' && (
              <div className="panel-card rounded-2xl p-4">
                <Label>Single-stage format</Label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SINGLE_STAGE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        patchSettings({ singleStageFormat: o.value })
                      }
                      className={`rounded-xl px-3 py-2 text-left text-sm ${
                        settings.singleStageFormat === o.value
                          ? 'choice-btn-active'
                          : 'choice-btn'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {settings.stageMode === 'TWO_STAGE' && (
              <div className="panel-card space-y-4 rounded-2xl p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label>Participants per group</Label>
                    <Input
                      type="number"
                      min={2}
                      max={32}
                      value={settings.participantsPerGroup}
                      onChange={(e) =>
                        patchSettings({
                          participantsPerGroup: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Advance per group</Label>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      value={settings.advancePerGroup}
                      onChange={(e) =>
                        patchSettings({
                          advancePerGroup: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Meetings per pair</Label>
                    <Input
                      type="number"
                      min={1}
                      max={4}
                      value={settings.meetingsPerPair}
                      onChange={(e) =>
                        patchSettings({
                          meetingsPerPair: Number(e.target.value),
                        })
                      }
                    />
                    <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                      How many times each pair plays in groups
                    </p>
                  </div>
                </div>
                <div>
                  <Label>Final stage process</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {FINAL_STAGE_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() =>
                          patchSettings({ finalStageFormat: o.value })
                        }
                        className={`rounded-xl px-3 py-2 text-left text-sm ${
                          settings.finalStageFormat === o.value
                            ? 'choice-btn-active'
                            : 'choice-btn'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="panel-card rounded-2xl p-4">
              <Label>Rank by</Label>
              <Select
                className="mt-2"
                value={settings.rankBy}
                onChange={(v) =>
                  patchSettings({
                    rankBy: v as TournamentSettings['rankBy'],
                  })
                }
                options={RANK_BY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
              />
            </div>

            <Toggle
              checked={settings.breakTiesWithPlacement}
              onChange={(v) => patchSettings({ breakTiesWithPlacement: v })}
              label="Break ties with placement matches"
              hint="Adds a 3rd-place match (international standard)"
            />

            <Toggle
              checked={settings.useHeadToHead}
              onChange={(v) => patchSettings({ useHeadToHead: v })}
              label="Head-to-head tiebreaker"
              hint="FIFA-style: compare results between tied teams"
            />

            <Toggle
              checked={settings.useBuchholzSwiss}
              onChange={(v) => patchSettings({ useBuchholzSwiss: v })}
              label="Buchholz tiebreaker (Swiss)"
              hint="Sum of opponents' points — FIDE standard"
            />

            <Toggle
              checked={settings.doubleElimBracketReset}
              onChange={(v) => patchSettings({ doubleElimBracketReset: v })}
              label="Double elim bracket reset"
              hint="If losers-bracket champ wins grand final, play a reset match"
            />

            <div className="panel-card rounded-2xl p-4">
              <Label>Knockout best-of series</Label>
              <Select
                className="mt-2"
                value={String(settings.knockoutBestOf)}
                onChange={(v) =>
                  patchSettings({ knockoutBestOf: Number(v) })
                }
                options={[
                  { value: '1', label: 'Single game (Bo1)' },
                  { value: '3', label: 'Best of 3 (Bo3)' },
                  { value: '5', label: 'Best of 5 (Bo5)' },
                  { value: '7', label: 'Best of 7 (Bo7)' },
                ]}
              />
            </div>

            {(settings.singleStageFormat === 'GRAND_PRIX' ||
              settings.singleStageFormat === 'LEADERBOARD') && (
              <div className="panel-card rounded-2xl p-4">
                <Label>
                  {settings.singleStageFormat === 'GRAND_PRIX'
                    ? 'Number of races'
                    : 'Number of events'}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={
                    settings.singleStageFormat === 'GRAND_PRIX'
                      ? settings.raceCount
                      : settings.eventCount
                  }
                  onChange={(e) =>
                    patchSettings(
                      settings.singleStageFormat === 'GRAND_PRIX'
                        ? { raceCount: Number(e.target.value) }
                        : { eventCount: Number(e.target.value) },
                    )
                  }
                />
              </div>
            )}

            {(settings.singleStageFormat === 'SWISS' ||
              settings.finalStageFormat === 'SWISS') && (
              <>
              <div className="panel-card rounded-2xl p-4">
                <Label>Swiss rounds</Label>
                <Input
                  type="number"
                  min={2}
                  max={12}
                  value={settings.swissRounds}
                  onChange={(e) =>
                    patchSettings({ swissRounds: Number(e.target.value) })
                  }
                />
              </div>
              <div className="panel-card rounded-2xl p-4">
                <Label>Swiss pairing system</Label>
                <select
                  className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
                  value={settings.swissPairingMode ?? 'SIMPLE'}
                  onChange={(e) =>
                    patchSettings({
                      swissPairingMode: e.target.value as 'SIMPLE' | 'FIDE_DUTCH',
                    })
                  }
                >
                  <option value="SIMPLE">Simple score-group pairing</option>
                  <option value="FIDE_DUTCH">FIDE Dutch (with floaters)</option>
                </select>
              </div>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('basics')}>
                Back
              </Button>
              <Button disabled={pending} onClick={saveRules}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'registration' && (
          <div className="mt-8 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['HOST_LIST', 'Host provides participant list'],
                  ['OPEN_SIGNUP', 'Host signup page (open register)'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => patchSettings({ registrationMode: value })}
                  className={`rounded-2xl px-4 py-3 text-left text-sm ${
                    settings.registrationMode === value
                      ? 'choice-btn-active'
                      : 'choice-btn'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="panel-card rounded-2xl p-4">
                <Label>Max participants</Label>
                <Input
                  type="number"
                  min={2}
                  max={512}
                  value={settings.maxParticipants}
                  onChange={(e) =>
                    patchSettings({ maxParticipants: Number(e.target.value) })
                  }
                />
              </div>
              <div className="panel-card rounded-2xl p-4">
                <Label>Players per team</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.playersPerTeam}
                  onChange={(e) =>
                    patchSettings({ playersPerTeam: Number(e.target.value) })
                  }
                  disabled={!settings.requireTeamRegistration}
                />
              </div>
            </div>

            <Toggle
              checked={settings.requireTeamRegistration}
              onChange={(v) => patchSettings({ requireTeamRegistration: v })}
              label="Require participants to register as a team"
            />
            <Toggle
              checked={settings.playerNamesEditable}
              onChange={(v) => patchSettings({ playerNamesEditable: v })}
              label="Player names editable later"
            />
            <Toggle
              checked={settings.allowSubstitutes}
              onChange={(v) =>
                patchSettings({
                  allowSubstitutes: v,
                  ...(v && !settings.substituteSlots
                    ? { substituteSlots: 3 }
                    : {}),
                })
              }
              label="Allow substitute players"
            />
            {settings.allowSubstitutes && (
              <div className="panel-card rounded-2xl p-4">
                <Label>Extra substitute slots per team</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  className="mt-1"
                  value={settings.substituteSlots ?? 0}
                  onChange={(e) =>
                    patchSettings({ substituteSlots: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Max roster = {settings.playersPerTeam} starters +{' '}
                  {settings.substituteSlots ?? 0} subs ={' '}
                  {settings.playersPerTeam + (settings.substituteSlots ?? 0)}{' '}
                  players
                </p>
              </div>
            )}
            <Toggle
              checked={settings.tentative}
              onChange={(v) => patchSettings({ tentative: v })}
              label="Tentative tournament"
              hint="Mark schedule as not final"
            />

            <h3 className="pt-2 font-display text-lg font-semibold">
              International rules
            </h3>
            <Toggle
              checked={settings.enableToss}
              onChange={(v) => patchSettings({ enableToss: v })}
              label="Enable toss system"
            />
            <Toggle
              checked={settings.requireCheckIn ?? false}
              onChange={(v) => patchSettings({ requireCheckIn: v })}
              label="Require check-in before results"
            />
            <Toggle
              checked={settings.lockRosterAfterGenerate ?? false}
              onChange={(v) => patchSettings({ lockRosterAfterGenerate: v })}
              label="Lock roster after bracket generate"
            />
            <Toggle
              checked={settings.useFairPlayTiebreaker ?? false}
              onChange={(v) => patchSettings({ useFairPlayTiebreaker: v })}
              label="Fair play tiebreaker"
            />
            <div className="panel-card rounded-2xl p-4 sm:col-span-2">
              <Label>Group draw method (on generate)</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
                value={settings.groupDrawMode ?? 'SERPENTINE'}
                onChange={(e) =>
                  patchSettings({
                    groupDrawMode: e.target
                      .value as import('@bracket/shared').TournamentSettings['groupDrawMode'],
                  })
                }
              >
                <option value="SERPENTINE">Serpentine (by seed)</option>
                <option value="POT">Pot draw (UEFA-style)</option>
                <option value="BALANCED">Random balanced serpentine</option>
                <option value="RANDOM">Random groups</option>
              </select>
            </div>
            <div className="panel-card rounded-2xl p-4">
              <Label>Forfeit score (winner – loser)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-16"
                  value={settings.forfeitScoreWinner ?? 3}
                  onChange={(e) =>
                    patchSettings({ forfeitScoreWinner: Number(e.target.value) })
                  }
                />
                <span>–</span>
                <Input
                  type="number"
                  min={0}
                  className="w-16"
                  value={settings.forfeitScoreLoser ?? 0}
                  onChange={(e) =>
                    patchSettings({ forfeitScoreLoser: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <Toggle
              checked={settings.advanceBestThirds ?? false}
              onChange={(v) => patchSettings({ advanceBestThirds: v })}
              label="Advance best third-place teams (Euro 24-team)"
            />
            {settings.advanceBestThirds && (
              <div className="panel-card rounded-2xl p-4">
                <Label>Best thirds to advance</Label>
                <Input
                  type="number"
                  min={1}
                  max={16}
                  className="mt-1"
                  value={settings.bestThirdsCount ?? 4}
                  onChange={(e) =>
                    patchSettings({ bestThirdsCount: Number(e.target.value) })
                  }
                />
              </div>
            )}
            <Toggle
              checked={settings.twoLeggedKnockout ?? false}
              onChange={(v) => patchSettings({ twoLeggedKnockout: v })}
              label="Two-legged knockout ties"
            />
            <Toggle
              checked={settings.twoLeggedGroup ?? false}
              onChange={(v) => patchSettings({ twoLeggedGroup: v })}
              label="Two-legged group stage ties"
            />
            <Toggle
              checked={settings.twoLeggedAwayGoals ?? false}
              onChange={(v) => patchSettings({ twoLeggedAwayGoals: v })}
              label="Away goals rule"
            />
            <Toggle
              checked={settings.knockoutExtraTime ?? false}
              onChange={(v) => patchSettings({ knockoutExtraTime: v })}
              label="Extra time on knockout draws"
            />
            <Toggle
              checked={settings.knockoutPenalties !== false}
              onChange={(v) => patchSettings({ knockoutPenalties: v })}
              label="Penalty shootout tiebreaker"
            />
            <Toggle
              checked={settings.auditableDraw ?? false}
              onChange={(v) => patchSettings({ auditableDraw: v })}
              label="Auditable draw (seeded RNG)"
            />
            <Toggle
              checked={settings.enableMvp !== false}
              onChange={(v) => patchSettings({ enableMvp: v })}
              label="Enable MVP awards"
            />
            <div className="panel-card rounded-2xl p-4">
              <Label>MVP selection</Label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
                value={settings.mvpMode ?? 'AUTO'}
                onChange={(e) =>
                  patchSettings({ mvpMode: e.target.value as 'AUTO' | 'MANUAL' })
                }
              >
                <option value="AUTO">Automatic (by stats)</option>
                <option value="MANUAL">Manual pick required</option>
              </select>
            </div>
            <div className="panel-card rounded-2xl p-4 sm:col-span-2">
              <Label>MVP stat weights</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ['goals', 'Goals'],
                    ['assists', 'Assists'],
                    ['points', 'Points'],
                    ['kills', 'Kills'],
                    ['deaths', 'Deaths'],
                    ['rating', 'Rating'],
                    ['winBonus', 'Win bonus'],
                  ] as const
                ).map(([key, label]) => {
                  const weights = mvpWeightsSchema.parse(settings.mvpWeights ?? {});
                  return (
                    <div key={key}>
                      <label className="text-xs">{label}</label>
                      <Input
                        type="number"
                        step={key === 'deaths' ? 0.1 : 1}
                        className="mt-1"
                        value={weights[key]}
                        onChange={(e) =>
                          patchSettings({
                            mvpWeights: {
                              ...weights,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel-card rounded-2xl p-4 sm:col-span-2">
              <Label>MVP round multipliers</Label>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Optional weight multiplier per knockout round (e.g. 2.0 for final)
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((round) => (
                  <div key={round}>
                    <label className="text-xs">Round {round}</label>
                    <Input
                      type="number"
                      step={0.1}
                      min={0}
                      className="mt-1"
                      value={settings.mvpRoundMultipliers?.[String(round)] ?? ''}
                      placeholder="1"
                      onChange={(e) => {
                        const val = e.target.value;
                        const next = { ...(settings.mvpRoundMultipliers ?? {}) };
                        if (val === '') delete next[String(round)];
                        else next[String(round)] = Number(val);
                        patchSettings({ mvpRoundMultipliers: next });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <Toggle
              checked={settings.enableMatchVoting ?? false}
              onChange={(v) => patchSettings({ enableMatchVoting: v })}
              label="Enable match voting"
            />
            <Toggle
              checked={settings.enableBracketPredictions ?? false}
              onChange={(v) => patchSettings({ enableBracketPredictions: v })}
              label="Enable bracket predictions"
            />
            <Toggle
              checked={settings.allowCustomPredictionFields ?? false}
              onChange={(v) =>
                patchSettings({ allowCustomPredictionFields: v })
              }
              label="Custom prediction fields"
            />
            <Toggle
              checked={settings.allowAnonymousPredictions ?? false}
              onChange={(v) =>
                patchSettings({ allowAnonymousPredictions: v })
              }
              label="Anonymous predictions"
            />
            {settings.allowCustomPredictionFields && (
              <div className="sm:col-span-2">
                <PredictionCustomFieldsEditor
                  fields={settings.predictionCustomFields ?? []}
                  onChange={(fields) =>
                    patchSettings({ predictionCustomFields: fields })
                  }
                />
              </div>
            )}
            <Toggle
              checked={settings.showCustomRoundLabels}
              onChange={(v) => patchSettings({ showCustomRoundLabels: v })}
              label="Custom round labels"
            />
            {settings.showCustomRoundLabels && (
              <div className="panel-card rounded-2xl p-4 sm:col-span-2">
                <Label>Round labels</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((r) => (
                    <div key={r}>
                      <label className="text-xs">Round {r}</label>
                      <Input
                        className="mt-1"
                        value={settings.roundLabels?.[String(r)] ?? ''}
                        onChange={(e) =>
                          patchSettings({
                            roundLabels: {
                              ...(settings.roundLabels ?? {}),
                              [String(r)]: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 className="pt-2 font-display text-lg font-semibold">
              Advanced display & play
            </h3>
            <Toggle
              checked={settings.hideSeedNumbers}
              onChange={(v) => patchSettings({ hideSeedNumbers: v })}
              label="Hide seed numbers"
            />
            <Toggle
              checked={settings.hideBracketPreviewPublic}
              onChange={(v) => patchSettings({ hideBracketPreviewPublic: v })}
              label="Hide bracket preview from the public"
            />
            <Toggle
              checked={settings.quickAdvanceWinnersOnly}
              onChange={(v) => patchSettings({ quickAdvanceWinnersOnly: v })}
              label="Quick advance — report winners only (no scores)"
            />
            <Toggle
              checked={settings.allowMatchAttachments}
              onChange={(v) => patchSettings({ allowMatchAttachments: v })}
              label="Allow match attachments"
            />

            <h3 className="pt-2 font-display text-lg font-semibold">
              Sharing, access & discovery
            </h3>
            <Toggle
              checked={settings.enableShareableMatchImages}
              onChange={(v) =>
                patchSettings({ enableShareableMatchImages: v })
              }
              label="Generate shareable match-result images"
              hint="Works for Single/Double Elim, Round Robin, and Swiss"
            />
            <Toggle
              checked={settings.requireVerifiedEmail}
              onChange={(v) => patchSettings({ requireVerifiedEmail: v })}
              label="Require verified email before joining"
            />
            <Toggle
              checked={settings.restrictByCountry}
              onChange={(v) => patchSettings({ restrictByCountry: v })}
              label="Allow only specific countries to register"
            />
            {settings.restrictByCountry && (
              <div className="panel-card rounded-xl p-3">
                <Label>Allowed countries</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COUNTRY_OPTIONS.map((c) => {
                    const on = settings.allowedCountries.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          const next = on
                            ? settings.allowedCountries.filter(
                                (x) => x !== c.code,
                              )
                            : [...settings.allowedCountries, c.code];
                          patchSettings({ allowedCountries: next });
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          on ? 'choice-btn-active' : 'choice-btn'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Toggle
              checked={settings.allowParticipantsReportScores}
              onChange={(v) =>
                patchSettings({ allowParticipantsReportScores: v })
              }
              label="Allow participants to report their own match scores"
            />
            <Toggle
              checked={settings.excludeFromSearchEngines}
              onChange={(v) => patchSettings({ excludeFromSearchEngines: v })}
              label="Exclude this event from search engines (noindex)"
            />
            <Toggle
              checked={settings.browsableInIndex}
              onChange={(v) => patchSettings({ browsableInIndex: v })}
              label="Show in browsable tournament index"
            />
            <Toggle
              checked={settings.notifyMatchAvailable}
              onChange={(v) => patchSettings({ notifyMatchAvailable: v })}
              label="Notify users when their match is available"
            />
            <Toggle
              checked={settings.sendFinalResultsEmail}
              onChange={(v) => patchSettings({ sendFinalResultsEmail: v })}
              label="Send final results when the event ends"
            />
            <Toggle
              checked={settings.showAnnouncementTab}
              onChange={(v) => patchSettings({ showAnnouncementTab: v })}
              label="Show announcements tab"
            />
            <Toggle
              checked={settings.showStandings}
              onChange={(v) => patchSettings({ showStandings: v })}
              label="Show standings"
            />

            <div className="panel-card rounded-2xl p-4">
              <Label>Place participants in bracket using</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['TRADITIONAL', 'Traditional seeding rules'],
                    ['LIST_ORDER', 'Order of participants list'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchSettings({ seedingMode: value })}
                    className={`rounded-xl px-3 py-2 text-left text-sm ${
                      settings.seedingMode === value
                        ? 'choice-btn-active'
                        : 'choice-btn'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setStep('rules')}>
                Back
              </Button>
              <Button disabled={pending} onClick={saveRegistration}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'teams' && (
          <div className="panel-card mt-8 space-y-4 rounded-2xl p-6">
            <BulkTeamInput
              maxCount={settings.maxParticipants}
              showPlayerHint={
                settings.requireTeamRegistration || settings.playersPerTeam > 1
              }
              onApply={(teams) => {
                setTeamCount(Math.min(teams.length, settings.maxParticipants));
                setTeamNames(
                  teams.map((t) => t.name).slice(0, settings.maxParticipants),
                );
                setTeamPlayers(
                  teams.slice(0, settings.maxParticipants).map((t) => {
                    const min = settings.requireTeamRegistration
                      ? settings.playersPerTeam
                      : 0;
                    const fromPaste = t.players ?? [];
                    const len = Math.max(min, fromPaste.length);
                    return Array.from({ length: len }, (_, i) => fromPaste[i] ?? '');
                  }),
                );
              }}
            />
            <div>
              <Label>Number of participants / teams</Label>
              <Input
                type="number"
                min={2}
                max={settings.maxParticipants}
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
              />
            </div>
            <div className="max-h-[480px] space-y-4 overflow-y-auto pr-1">
              {teamNames.map((n, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--color-line)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-xs text-[var(--color-muted)]">
                      #{i + 1}
                    </span>
                    <Input
                      value={n}
                      onChange={(e) => {
                        const next = [...teamNames];
                        next[i] = e.target.value;
                        setTeamNames(next);
                      }}
                      placeholder="Team / participant name"
                    />
                  </div>
                  {(settings.requireTeamRegistration ||
                    settings.playersPerTeam > 1 ||
                    (teamPlayers[i]?.length ?? 0) > 0) && (
                    <div className="mt-2 space-y-1 pl-16">
                      {(teamPlayers[i] ?? []).map((p, pi) => (
                        <div key={pi} className="flex gap-2">
                          <Input
                            className="flex-1"
                            value={p}
                            onChange={(e) => {
                              const next = teamPlayers.map((row) => [...row]);
                              next[i][pi] = e.target.value;
                              setTeamPlayers(next);
                            }}
                            placeholder={`Player ${pi + 1}`}
                          />
                          {!settings.requireTeamRegistration ||
                          (teamPlayers[i]?.length ?? 0) >
                            settings.playersPerTeam ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="shrink-0 text-red-600"
                              onClick={() => removePlayerRow(i, pi)}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => addPlayerRow(i)}
                      >
                        + Add player
                      </Button>
                    </div>
                  )}
                  {!(
                    settings.requireTeamRegistration ||
                    settings.playersPerTeam > 1 ||
                    (teamPlayers[i]?.length ?? 0) > 0
                  ) && (
                    <div className="mt-2 pl-16">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => addPlayerRow(i)}
                      >
                        + Add players (optional)
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setStep('registration')}
              >
                Back
              </Button>
              <Button disabled={pending} onClick={finish}>
                Generate tournament
              </Button>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </main>
    </div>
  );
}
