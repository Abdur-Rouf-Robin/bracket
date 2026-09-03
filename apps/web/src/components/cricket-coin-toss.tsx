'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export type CoinSide = 'HEADS' | 'TAILS';
export type TossDecision = 'BAT' | 'BOWL';

export type CoinTossResult = {
  winnerSide: string;
  winnerName: string;
  decision: TossDecision;
  coinResult: CoinSide;
  callingSide: string;
  callingName: string;
  callingChoice: CoinSide;
};

type Props = {
  homeName: string;
  awayName: string;
  /** Identifier for home team — `'home'` or team id */
  homeSide: string;
  /** Identifier for away team — `'away'` or team id */
  awaySide: string;
  onComplete: (result: CoinTossResult) => void;
  onSave?: () => void;
  saving?: boolean;
  /** Already recorded toss — read-only summary */
  recorded?: {
    winnerName: string;
    decision: TossDecision;
    coinResult?: CoinSide;
    callingName?: string;
    callingChoice?: CoinSide;
  } | null;
};

type Phase = 'call' | 'flipping' | 'result' | 'decision' | 'done';

function sideName(side: string, homeSide: string, homeName: string, awayName: string) {
  return side === homeSide ? homeName : awayName;
}

export function CricketCoinToss({
  homeName,
  awayName,
  homeSide,
  awaySide,
  onComplete,
  onSave,
  saving = false,
  recorded,
}: Props) {
  const [phase, setPhase] = useState<Phase>(recorded ? 'done' : 'call');
  const [callingSide, setCallingSide] = useState(homeSide);
  const [callingChoice, setCallingChoice] = useState<CoinSide>('HEADS');
  const [coinResult, setCoinResult] = useState<CoinSide | null>(
    recorded?.coinResult ?? null,
  );
  const [winnerSide, setWinnerSide] = useState<string | null>(null);
  const [decision, setDecision] = useState<TossDecision>(
    recorded?.decision ?? 'BAT',
  );
  const [flipKey, setFlipKey] = useState(0);

  const callingName = sideName(callingSide, homeSide, homeName, awayName);
  const otherSide = callingSide === homeSide ? awaySide : homeSide;
  const otherName = sideName(otherSide, homeSide, homeName, awayName);
  const otherChoice: CoinSide = callingChoice === 'HEADS' ? 'TAILS' : 'HEADS';

  const winnerName = winnerSide
    ? sideName(winnerSide, homeSide, homeName, awayName)
    : recorded?.winnerName ?? '';

  const flipRotation = useMemo(() => {
    if (!coinResult) return 0;
    const baseSpins = 5;
    return baseSpins * 360 + (coinResult === 'TAILS' ? 180 : 0);
  }, [coinResult, flipKey]);

  function flipCoin() {
    if (phase !== 'call') return;
    const result: CoinSide = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
    const winner = result === callingChoice ? callingSide : otherSide;
    setCoinResult(result);
    setWinnerSide(winner);
    setFlipKey((k) => k + 1);
    setPhase('flipping');
    window.setTimeout(() => setPhase('result'), 2200);
    window.setTimeout(() => setPhase('decision'), 3800);
  }

  function confirmDecision(d: TossDecision) {
    if (!winnerSide || !coinResult) return;
    setDecision(d);
    const result: CoinTossResult = {
      winnerSide,
      winnerName: sideName(winnerSide, homeSide, homeName, awayName),
      decision: d,
      coinResult,
      callingSide,
      callingName,
      callingChoice,
    };
    setPhase('done');
    onComplete(result);
  }

  if (recorded && phase === 'done' && !winnerSide) {
    return (
      <div className="space-y-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-surface)]/50 p-4">
        <p className="text-center text-sm font-semibold text-[var(--color-ink)]">
          {recorded.winnerName} won the toss
          {recorded.coinResult ? ` (${recorded.coinResult})` : ''} and elected to{' '}
          {recorded.decision === 'BAT' ? 'bat first' : 'bowl first'}.
        </p>
        {recorded.callingName && recorded.callingChoice && (
          <p className="text-center text-xs text-[var(--color-muted)]">
            {recorded.callingName} called {recorded.callingChoice}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]/40 p-4">
      {/* Coin */}
      <div className="flex flex-col items-center gap-3 py-2">
        <div
          className="coin-scene"
          aria-hidden={phase === 'call'}
        >
          <div
            key={flipKey}
            className={`coin ${phase === 'flipping' ? 'coin-flip' : ''}`}
            style={
              {
                '--coin-rotation': `${flipRotation}deg`,
                ...(phase === 'result' || phase === 'decision' || phase === 'done'
                  ? { transform: `rotateY(${flipRotation}deg)` }
                  : {}),
              } as CSSProperties
            }
          >
            <div className="coin-face coin-heads">
              <span>HEADS</span>
            </div>
            <div className="coin-face coin-tails">
              <span>TAILS</span>
            </div>
          </div>
        </div>

        {phase === 'call' && (
          <p className="text-center text-sm text-[var(--color-muted)]">
            Choose who calls, then flip the coin
          </p>
        )}
        {phase === 'flipping' && (
          <p className="animate-pulse text-center text-sm font-semibold text-[var(--color-accent)]">
            Flipping…
          </p>
        )}
        {(phase === 'result' || phase === 'decision' || phase === 'done') && coinResult && (
          <p className="text-center font-display text-lg font-bold text-[var(--color-ink)]">
            {coinResult}!
          </p>
        )}
      </div>

      {phase === 'call' && (
        <>
          <div>
            <Label className="text-xs">Who calls?</Label>
            <div className="mt-2 flex gap-2">
              {[homeSide, awaySide].map((side) => {
                const name = sideName(side, homeSide, homeName, awayName);
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setCallingSide(side)}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
                      callingSide === side
                        ? 'bg-[var(--color-accent)] text-[#041018]'
                        : 'border border-[var(--color-line)]'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs">{callingName} calls</Label>
            <div className="mt-2 flex gap-2">
              {(['HEADS', 'TAILS'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCallingChoice(c)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
                    callingChoice === c
                      ? 'bg-amber-500 text-[#041018]'
                      : 'border border-[var(--color-line)]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-ink)]">{callingName}</span>{' '}
              → {callingChoice} ·{' '}
              <span className="font-semibold text-[var(--color-ink)]">{otherName}</span> →{' '}
              {otherChoice}
            </p>
          </div>

          <Button type="button" className="w-full" onClick={flipCoin}>
            Flip coin
          </Button>
        </>
      )}

      {phase === 'result' && winnerSide && (
        <p className="animate-in fade-in text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {winnerName} won the toss!
        </p>
      )}

      {phase === 'decision' && winnerSide && (
        <div className="space-y-3">
          <p className="text-center text-sm text-[var(--color-muted)]">
            <span className="font-semibold text-[var(--color-ink)]">{winnerName}</span> won
            the toss — choose bat or bowl
          </p>
          <div className="flex gap-2">
            {(['BAT', 'BOWL'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => confirmDecision(d)}
                className={`flex-1 rounded-md px-4 py-3 text-sm font-bold ${
                  decision === d
                    ? 'bg-[var(--color-accent)] text-[#041018]'
                    : 'border-2 border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10'
                }`}
              >
                {d === 'BAT' ? 'Bat first' : 'Bowl first'}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && winnerSide && (
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {winnerName} won the toss ({coinResult}) and elected to{' '}
            {decision === 'BAT' ? 'bat first' : 'bowl first'}.
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            {callingName} called {callingChoice}
          </p>
          {onSave && (
            <Button type="button" className="w-full" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm toss'}
            </Button>
          )}
        </div>
      )}

    </div>
  );
}
