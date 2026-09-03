'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { SportNav } from '@/components/sport-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultBowlerLimits } from '@bracket/shared';
import { CricketCoinToss, type CoinTossResult } from '@/components/cricket-coin-toss-dynamic';
import { api } from '@/lib/api';

type PlayerRow = { id: string; name: string };

function defaultPlayers(prefix: string, count: number): PlayerRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function resizeSquad(current: PlayerRow[], prefix: string, count: number): PlayerRow[] {
  const next = Math.min(30, Math.max(1, count));
  return Array.from({ length: next }, (_, i) => {
    const existing = current[i];
    return existing ?? { id: `${prefix}-p${i + 1}`, name: `Player ${i + 1}` };
  });
}

export default function FreeCricketNewPage() {
  const router = useRouter();
  const [homeTeamName, setHomeTeamName] = useState('Team A');
  const [awayTeamName, setAwayTeamName] = useState('Team B');
  const [format, setFormat] = useState<'T20' | 'ODI' | 'CUSTOM'>('T20');
  const [maxOvers, setMaxOvers] = useState('20');
  const [ballsPerOver, setBallsPerOver] = useState('6');
  const [maxOversPerBowler, setMaxOversPerBowler] = useState('4');
  const [maxBowlersAtLimit, setMaxBowlersAtLimit] = useState('5');
  const [homeSquadSize, setHomeSquadSize] = useState(11);
  const [awaySquadSize, setAwaySquadSize] = useState(11);
  const [homePlayers, setHomePlayers] = useState(defaultPlayers('home', 11));
  const [awayPlayers, setAwayPlayers] = useState(defaultPlayers('away', 11));
  const [strikeRotationMode, setStrikeRotationMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [tossWinnerSide, setTossWinnerSide] = useState<'home' | 'away'>('home');
  const [tossDecision, setTossDecision] = useState<'BAT' | 'BOWL'>('BAT');
  const [includeToss, setIncludeToss] = useState(true);
  const [tossDone, setTossDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function onHomeSquadSizeChange(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setHomeSquadSize(n);
    setHomePlayers((rows) => resizeSquad(rows, 'home', n));
  }

  function onAwaySquadSizeChange(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setAwaySquadSize(n);
    setAwayPlayers((rows) => resizeSquad(rows, 'away', n));
  }

  function selectFormat(next: 'T20' | 'ODI' | 'CUSTOM') {
    const overs = next === 'T20' ? 20 : next === 'ODI' ? 50 : 8;
    setFormat(next);
    setMaxOvers(String(overs));
    const limits = defaultBowlerLimits(overs, next);
    setMaxOversPerBowler(String(limits.maxOversPerBowler));
    setMaxBowlersAtLimit(String(limits.maxBowlersAtLimit));
  }

  function onMaxOversChange(raw: string) {
    setMaxOvers(raw);
    const overs = Number(raw);
    if (!Number.isFinite(overs) || overs < 1) return;
    if (format === 'CUSTOM') {
      const limits = defaultBowlerLimits(overs, 'CUSTOM');
      setMaxOversPerBowler(String(limits.maxOversPerBowler));
      setMaxBowlersAtLimit(String(limits.maxBowlersAtLimit));
    }
  }

  function onTossComplete(result: CoinTossResult) {
    setTossWinnerSide(result.winnerSide as 'home' | 'away');
    setTossDecision(result.decision);
    setTossDone(true);
  }

  async function create() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{
        slug: string;
        editToken: string;
        url: string;
      }>('/cricket/standalone', {
        method: 'POST',
        body: JSON.stringify({
          homeTeamName,
          awayTeamName,
          homePlayers: homePlayers.filter((p) => p.name.trim()),
          awayPlayers: awayPlayers.filter((p) => p.name.trim()),
          format,
          maxOvers: Number(maxOvers),
          ballsPerOver: Number(ballsPerOver),
          maxOversPerBowler: Number(maxOversPerBowler),
          maxBowlersAtLimit: Number(maxBowlersAtLimit),
          strikeRotationMode,
          ...(includeToss
            ? { toss: { winnerSide: tossWinnerSide, decision: tossDecision } }
            : {}),
        }),
      });
      localStorage.setItem(`cricket-edit-${res.slug}`, res.editToken);
      router.push(`/sports/cricket/live/${res.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create scoreboard');
    } finally {
      setLoading(false);
    }
  }

  function updatePlayer(
    side: 'home' | 'away',
    index: number,
    name: string,
  ) {
    const setter = side === 'home' ? setHomePlayers : setAwayPlayers;
    setter((rows) => rows.map((r, i) => (i === index ? { ...r, name } : r)));
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SportNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/sports/cricket" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← Cricket hub
        </Link>
        <h1 className="font-display mt-4 text-3xl font-bold">Free scoreboard</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Set any squad size (1–30 players per team). No international rules required.
        </p>

        <div className="gaming-card mt-8 space-y-6 rounded-xl p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Home team</Label>
              <Input className="mt-1" value={homeTeamName} onChange={(e) => setHomeTeamName(e.target.value)} />
            </div>
            <div>
              <Label>Away team</Label>
              <Input className="mt-1" value={awayTeamName} onChange={(e) => setAwayTeamName(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{homeTeamName} — players in squad</Label>
              <Input
                type="number"
                min={1}
                max={30}
                className="mt-1"
                value={homeSquadSize}
                onChange={(e) => onHomeSquadSizeChange(e.target.value)}
              />
            </div>
            <div>
              <Label>{awayTeamName} — players in squad</Label>
              <Input
                type="number"
                min={1}
                max={30}
                className="mt-1"
                value={awaySquadSize}
                onChange={(e) => onAwaySquadSizeChange(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Format</Label>
            <div className="mt-2 flex gap-2">
              {(['T20', 'ODI', 'CUSTOM'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => selectFormat(f)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    format === f
                      ? 'bg-[var(--color-accent)] text-[#041018]'
                      : 'border border-[var(--color-line)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Overs per innings</Label>
              <Input
                type="number"
                min={1}
                max={300}
                className="mt-1"
                value={maxOvers}
                onChange={(e) => onMaxOversChange(e.target.value)}
                placeholder={format === 'CUSTOM' ? 'e.g. 8' : '20'}
              />
            </div>
            <div>
              <Label>Balls per over</Label>
              <Input
                type="number"
                min={4}
                max={10}
                className="mt-1"
                value={ballsPerOver}
                onChange={(e) => setBallsPerOver(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Max overs per bowler</Label>
              <Input
                type="number"
                min={1}
                max={50}
                className="mt-1"
                value={maxOversPerBowler}
                onChange={(e) => setMaxOversPerBowler(e.target.value)}
              />
            </div>
            <div>
              <Label>Bowlers allowed at that max</Label>
              <Input
                type="number"
                min={1}
                max={30}
                className="mt-1"
                value={maxBowlersAtLimit}
                onChange={(e) => setMaxBowlersAtLimit(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Each bowler can bowl up to {maxOversPerBowler || '—'} overs. Only{' '}
            {maxBowlersAtLimit || '—'} bowler(s) may reach that limit — others are capped at{' '}
            {Math.max(1, Number(maxOversPerBowler) - 1) || '—'} overs.
          </p>

          <div>
            <Label>Strike rotation</Label>
            <div className="mt-2 flex gap-2">
              {(['AUTO', 'MANUAL'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStrikeRotationMode(mode)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    strikeRotationMode === mode
                      ? 'bg-[var(--color-accent)] text-[#041018]'
                      : 'border border-[var(--color-line)]'
                  }`}
                >
                  {mode === 'AUTO' ? 'Auto (rules)' : 'Manual'}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Auto swaps striker on odd runs and at end of over. Manual lets you swap yourself.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Toss</Label>
              <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={includeToss}
                  onChange={(e) => {
                    setIncludeToss(e.target.checked);
                    if (!e.target.checked) setTossDone(false);
                  }}
                />
                Record toss on this match
              </label>
            </div>
            {includeToss ? (
              <div className="mt-3">
                <CricketCoinToss
                  homeName={homeTeamName || 'Home team'}
                  awayName={awayTeamName || 'Away team'}
                  homeSide="home"
                  awaySide="away"
                  onComplete={onTossComplete}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                You can record the toss later on the live scoreboard with a coin flip.
              </p>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold">{homeTeamName} squad</p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {homePlayers.map((p, i) => (
                  <Input
                    key={p.id}
                    value={p.name}
                    onChange={(e) => updatePlayer('home', i, e.target.value)}
                    className="text-sm"
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">{awayTeamName} squad</p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {awayPlayers.map((p, i) => (
                  <Input
                    key={p.id}
                    value={p.name}
                    onChange={(e) => updatePlayer('away', i, e.target.value)}
                    className="text-sm"
                  />
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <Button onClick={create} disabled={loading || (includeToss && !tossDone)}>
            {loading ? 'Creating…' : includeToss && !tossDone ? 'Complete toss first' : 'Start free scoreboard'}
          </Button>
        </div>
      </main>
    </div>
  );
}
