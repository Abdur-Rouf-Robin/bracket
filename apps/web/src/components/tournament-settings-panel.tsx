'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import type { TournamentSettings } from '@bracket/shared';
import { COUNTRY_OPTIONS, mvpWeightsSchema } from '@bracket/shared';
import { PredictionCustomFieldsEditor } from '@/components/prediction-custom-fields-editor';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function TournamentSettingsPanel({
  tournament,
  token,
  embedded = false,
}: {
  tournament: Tournament;
  token: string;
  embedded?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(embedded);
  const settings = (tournament.settings ?? {}) as TournamentSettings;

  const mutation = useMutation({
    mutationFn: async (patch: Partial<TournamentSettings>) => {
      return api(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          settings: patch,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
  });

  if (!tournament.isOwner) return null;

  function patch(partial: Partial<TournamentSettings>) {
    mutation.mutate(partial);
  }

  const body = (
    <div className={embedded ? 'grid gap-3 sm:grid-cols-2' : 'panel-card mt-3 grid gap-3 rounded-xl p-4 sm:grid-cols-2'}>
          <Toggle
            label="Hide seed numbers"
            checked={settings.hideSeedNumbers ?? false}
            onChange={(v) => patch({ hideSeedNumbers: v })}
          />
          <Toggle
            label="Quick advance (winners only)"
            checked={settings.quickAdvanceWinnersOnly ?? false}
            onChange={(v) => patch({ quickAdvanceWinnersOnly: v })}
          />
          <Toggle
            label="Hide bracket preview public"
            checked={settings.hideBracketPreviewPublic ?? false}
            onChange={(v) => patch({ hideBracketPreviewPublic: v })}
          />
          <Toggle
            label="Allow match attachments"
            checked={settings.allowMatchAttachments ?? false}
            onChange={(v) => patch({ allowMatchAttachments: v })}
          />
          <Toggle
            label="Participants report scores"
            checked={settings.allowParticipantsReportScores ?? false}
            onChange={(v) => patch({ allowParticipantsReportScores: v })}
          />
          <Toggle
            label="Enable MVP"
            checked={settings.enableMvp !== false}
            onChange={(v) => patch({ enableMvp: v })}
          />
          <Toggle
            label="Show standings"
            checked={settings.showStandings !== false}
            onChange={(v) => patch({ showStandings: v })}
          />
          <Toggle
            label="Browsable in public index"
            checked={settings.browsableInIndex !== false}
            onChange={(v) => patch({ browsableInIndex: v })}
          />
          <Toggle
            label="Allow substitute players"
            checked={settings.allowSubstitutes ?? false}
            onChange={(v) => patch({ allowSubstitutes: v })}
          />
          {settings.allowSubstitutes && (
            <div className="sm:col-span-2 rounded-lg border border-[var(--color-line)] p-3">
              <label className="text-sm font-medium">
                Substitute slots per team
              </label>
              <input
                type="number"
                min={0}
                max={10}
                className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
                value={settings.substituteSlots ?? 0}
                onChange={(e) =>
                  patch({ substituteSlots: Number(e.target.value) })
                }
              />
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {settings.playersPerTeam} starters + {settings.substituteSlots ?? 0}{' '}
                subs = max{' '}
                {settings.playersPerTeam + (settings.substituteSlots ?? 0)} players
              </p>
            </div>
          )}

          <div className="sm:col-span-2 mt-2 border-t border-[var(--color-line)] pt-3">
            <p className="mb-2 text-sm font-semibold">International rules</p>
          </div>
          <Toggle
            label="Require check-in before results"
            checked={settings.requireCheckIn ?? false}
            onChange={(v) => patch({ requireCheckIn: v })}
          />
          <Toggle
            label="Lock roster after bracket generate"
            checked={settings.lockRosterAfterGenerate ?? false}
            onChange={(v) => patch({ lockRosterAfterGenerate: v })}
          />
          <Toggle
            label="Fair play tiebreaker (fewer cards wins)"
            checked={settings.useFairPlayTiebreaker ?? false}
            onChange={(v) => patch({ useFairPlayTiebreaker: v })}
          />
          <Toggle
            label="Head-to-head tiebreaker"
            checked={settings.useHeadToHead !== false}
            onChange={(v) => patch({ useHeadToHead: v })}
          />
          <Toggle
            label="Buchholz (Swiss tiebreak)"
            checked={settings.useBuchholzSwiss !== false}
            onChange={(v) => patch({ useBuchholzSwiss: v })}
          />
          <div className="rounded-lg border border-[var(--color-line)] p-3">
            <label className="text-sm font-medium">Group draw method</label>
            <select
              className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
              value={settings.groupDrawMode ?? 'SERPENTINE'}
              onChange={(e) =>
                patch({
                  groupDrawMode: e.target.value as TournamentSettings['groupDrawMode'],
                })
              }
            >
              <option value="SERPENTINE">Serpentine (by seed)</option>
              <option value="POT">Pot draw (UEFA-style)</option>
              <option value="BALANCED">Random balanced serpentine</option>
              <option value="RANDOM">Random groups</option>
            </select>
          </div>
          <div className="rounded-lg border border-[var(--color-line)] p-3">
            <label className="text-sm font-medium">Forfeit / walkover score</label>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="number"
                min={0}
                className="w-16 rounded-md border border-[var(--color-line)] px-2 py-1"
                value={settings.forfeitScoreWinner ?? 3}
                onChange={(e) =>
                  patch({ forfeitScoreWinner: Number(e.target.value) })
                }
              />
              <span>–</span>
              <input
                type="number"
                min={0}
                className="w-16 rounded-md border border-[var(--color-line)] px-2 py-1"
                value={settings.forfeitScoreLoser ?? 0}
                onChange={(e) =>
                  patch({ forfeitScoreLoser: Number(e.target.value) })
                }
              />
              <span className="text-xs text-[var(--color-muted)]">winner – loser</span>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-line)] p-3">
            <label className="text-sm font-medium">Knockout best-of</label>
            <input
              type="number"
              min={1}
              max={7}
              step={2}
              className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
              value={settings.knockoutBestOf ?? 1}
              onChange={(e) =>
                patch({ knockoutBestOf: Number(e.target.value) })
              }
            />
          </div>
          <Toggle
            label="Advance best third-place teams"
            checked={settings.advanceBestThirds ?? false}
            onChange={(v) => patch({ advanceBestThirds: v })}
          />
          {settings.advanceBestThirds && (
            <div className="rounded-lg border border-[var(--color-line)] p-3">
              <label className="text-sm font-medium">Best thirds to advance</label>
              <input
                type="number"
                min={1}
                max={16}
                className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
                value={settings.bestThirdsCount ?? 4}
                onChange={(e) =>
                  patch({ bestThirdsCount: Number(e.target.value) })
                }
              />
            </div>
          )}
          <Toggle
            label="Two-legged knockout ties"
            checked={settings.twoLeggedKnockout ?? false}
            onChange={(v) => patch({ twoLeggedKnockout: v })}
          />
          <Toggle
            label="Two-legged group stage ties"
            checked={settings.twoLeggedGroup ?? false}
            onChange={(v) => patch({ twoLeggedGroup: v })}
          />
          <Toggle
            label="Away goals rule (two-legged)"
            checked={settings.twoLeggedAwayGoals ?? false}
            onChange={(v) => patch({ twoLeggedAwayGoals: v })}
          />
          <Toggle
            label="Extra time on knockout draws"
            checked={settings.knockoutExtraTime ?? false}
            onChange={(v) => patch({ knockoutExtraTime: v })}
          />
          <Toggle
            label="Penalty shootout tiebreaker"
            checked={settings.knockoutPenalties !== false}
            onChange={(v) => patch({ knockoutPenalties: v })}
          />
          <Toggle
            label="Auditable draw (seeded RNG)"
            checked={settings.auditableDraw ?? false}
            onChange={(v) => patch({ auditableDraw: v })}
          />
          {settings.auditableDraw && tournament.slug && (
            <div className="sm:col-span-2">
              <a
                href={`/t/${tournament.slug}/draw`}
                className="text-sm text-[var(--color-accent)] underline"
              >
                Open live draw ceremony page
              </a>
            </div>
          )}
          <div className="rounded-lg border border-[var(--color-line)] p-3">
            <label className="text-sm font-medium">Swiss pairing system</label>
            <select
              className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
              value={settings.swissPairingMode ?? 'SIMPLE'}
              onChange={(e) =>
                patch({
                  swissPairingMode: e.target.value as 'SIMPLE' | 'FIDE_DUTCH',
                })
              }
            >
              <option value="SIMPLE">Simple score-group pairing</option>
              <option value="FIDE_DUTCH">FIDE Dutch (with floaters)</option>
            </select>
          </div>
          <Toggle
            label="Enable match voting"
            checked={settings.enableMatchVoting ?? false}
            onChange={(v) => patch({ enableMatchVoting: v })}
          />
          <Toggle
            label="Enable bracket predictions"
            checked={settings.enableBracketPredictions ?? false}
            onChange={(v) => patch({ enableBracketPredictions: v })}
          />
          <Toggle
            label="Custom prediction fields"
            checked={settings.allowCustomPredictionFields ?? false}
            onChange={(v) => patch({ allowCustomPredictionFields: v })}
          />
          <Toggle
            label="Anonymous predictions"
            checked={settings.allowAnonymousPredictions ?? false}
            onChange={(v) => patch({ allowAnonymousPredictions: v })}
          />
          {settings.allowCustomPredictionFields && (
            <div className="sm:col-span-2">
              <PredictionCustomFieldsEditor
                fields={settings.predictionCustomFields ?? []}
                onChange={(fields) => patch({ predictionCustomFields: fields })}
              />
            </div>
          )}

          <div className="sm:col-span-2 mt-2 border-t border-[var(--color-line)] pt-3">
            <p className="mb-2 text-sm font-semibold">MVP & labels</p>
          </div>
          <Toggle
            label="Custom round labels on bracket"
            checked={settings.showCustomRoundLabels ?? false}
            onChange={(v) => patch({ showCustomRoundLabels: v })}
          />
          {settings.showCustomRoundLabels && (
            <div className="sm:col-span-2 rounded-lg border border-[var(--color-line)] p-3">
              <p className="mb-2 text-xs text-[var(--color-muted)]">
                Round number → label (e.g. 1 = &quot;Round of 16&quot;)
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((r) => (
                  <div key={r}>
                    <label className="text-xs">Round {r}</label>
                    <input
                      className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
                      value={settings.roundLabels?.[String(r)] ?? ''}
                      onChange={(e) =>
                        patch({
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
          <div className="rounded-lg border border-[var(--color-line)] p-3">
            <label className="text-sm font-medium">MVP selection</label>
            <select
              className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
              value={settings.mvpMode ?? 'AUTO'}
              onChange={(e) =>
                patch({ mvpMode: e.target.value as 'AUTO' | 'MANUAL' })
              }
            >
              <option value="AUTO">Automatic (by stats)</option>
              <option value="MANUAL">Manual pick required</option>
            </select>
          </div>
          <div className="sm:col-span-2 rounded-lg border border-[var(--color-line)] p-3">
            <p className="mb-2 text-sm font-medium">MVP stat weights</p>
            <div className="grid gap-2 sm:grid-cols-3">
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
                    <input
                      type="number"
                      step={key === 'deaths' ? 0.1 : 1}
                      className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
                      value={weights[key]}
                      onChange={(e) =>
                        patch({
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
          <div className="sm:col-span-2 rounded-lg border border-[var(--color-line)] p-3">
            <p className="mb-2 text-sm font-medium">MVP round multipliers</p>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Optional weight multiplier per knockout round (e.g. 2.0 for final)
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((round) => (
                <div key={round}>
                  <label className="text-xs">Round {round}</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
                    value={settings.mvpRoundMultipliers?.[String(round)] ?? ''}
                    placeholder="1"
                    onChange={(e) => {
                      const val = e.target.value;
                      const next = { ...(settings.mvpRoundMultipliers ?? {}) };
                      if (val === '') delete next[String(round)];
                      else next[String(round)] = Number(val);
                      patch({ mvpRoundMultipliers: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <Toggle
            label="Tentative schedule (show badge publicly)"
            checked={settings.tentative ?? false}
            onChange={(v) => patch({ tentative: v })}
          />
          <Toggle
            label="Enable shareable match images"
            checked={settings.enableShareableMatchImages !== false}
            onChange={(v) => patch({ enableShareableMatchImages: v })}
          />

          <div className="sm:col-span-2 mt-2 border-t border-[var(--color-line)] pt-3">
            <p className="mb-2 text-sm font-semibold">Registration & seeding</p>
          </div>
          <Toggle
            label="Enable toss system"
            checked={settings.enableToss ?? false}
            onChange={(v) => patch({ enableToss: v })}
          />
          <Toggle
            label="Break ties with placement matches"
            checked={settings.breakTiesWithPlacement ?? false}
            onChange={(v) => patch({ breakTiesWithPlacement: v })}
          />
          <Toggle
            label="Double elim bracket reset"
            checked={settings.doubleElimBracketReset !== false}
            onChange={(v) => patch({ doubleElimBracketReset: v })}
          />
          <Toggle
            label="Allow only specific countries"
            checked={settings.restrictByCountry ?? false}
            onChange={(v) => patch({ restrictByCountry: v })}
          />
          {settings.restrictByCountry && (
            <div className="sm:col-span-2 rounded-lg border border-[var(--color-line)] p-3">
              <p className="mb-2 text-sm font-medium">Allowed countries</p>
              <div className="flex flex-wrap gap-2">
                {COUNTRY_OPTIONS.map((c) => {
                  const on = (settings.allowedCountries ?? []).includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        const current = settings.allowedCountries ?? [];
                        patch({
                          allowedCountries: on
                            ? current.filter((x) => x !== c.code)
                            : [...current, c.code],
                        });
                      }}
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        on
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'border border-[var(--color-line)]'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="sm:col-span-2 rounded-lg border border-[var(--color-line)] p-3">
            <label className="text-sm font-medium">Bracket seeding mode</label>
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
                  onClick={() => patch({ seedingMode: value })}
                  className={`rounded-lg px-3 py-2 text-left text-sm ${
                    (settings.seedingMode ?? 'TRADITIONAL') === value
                      ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]'
                      : 'border border-[var(--color-line)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Exclude from search engines"
            checked={settings.excludeFromSearchEngines ?? false}
            onChange={(v) => patch({ excludeFromSearchEngines: v })}
          />
          <Toggle
            label="Notify when match is available"
            checked={settings.notifyMatchAvailable !== false}
            onChange={(v) => patch({ notifyMatchAvailable: v })}
          />
          <Toggle
            label="Send final results when event ends"
            checked={settings.sendFinalResultsEmail ?? false}
            onChange={(v) => patch({ sendFinalResultsEmail: v })}
          />
          <Toggle
            label="Show announcements tab"
            checked={settings.showAnnouncementTab !== false}
            onChange={(v) => patch({ showAnnouncementTab: v })}
          />
          {mutation.isPending && (
            <p className="text-xs text-[var(--color-muted)] sm:col-span-2">
              Saving…
            </p>
          )}
          {!embedded && (
            <Button
              type="button"
              variant="ghost"
              className="sm:col-span-2"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          )}
    </div>
  );

  if (embedded) return body;

  return (
    <section className="mt-10">
      <button
        type="button"
        className="font-display text-xl font-semibold hover:text-[var(--color-accent)]"
        onClick={() => setOpen((v) => !v)}
      >
        Tournament settings {open ? '▾' : '▸'}
      </button>
      {open && body}
    </section>
  );
}
