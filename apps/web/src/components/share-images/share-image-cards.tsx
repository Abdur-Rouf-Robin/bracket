'use client';

import {
  formatShareDateTime,
  type AnySharePayload,
  type CongratsSharePayload,
  type MvpSharePayload,
  type PrematchSharePayload,
  type ResultSharePayload,
} from '@bracket/shared';
import { Trophy } from 'lucide-react';
import {
  CaptainPhoto,
  ShareImageFrame,
  TeamLogoOrBadge,
} from './share-image-frame';
import { teamColor } from '@/lib/team-display';

function PrematchCard({ data, exportId }: { data: PrematchSharePayload; exportId?: string }) {
  const homeColor = data.home.poolColor ?? teamColor({ name: data.home.name, poolColor: null });
  const awayColor = data.away.poolColor ?? teamColor({ name: data.away.name, poolColor: null });

  return (
    <ShareImageFrame
      tournament={data.tournament}
      exportId={exportId}
      accentLeft={homeColor}
      accentRight={awayColor}
    >
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
          {data.tournament.gameName ?? 'Match preview'}
        </p>
        <h2 className="font-display text-xl font-bold uppercase text-white">
          Upcoming match
        </h2>
        <p className="text-xs text-white/50">
          {data.roundLabel} · {data.bracketSide.replaceAll('_', ' ')}
        </p>
        {(data.scheduledAt || data.venue || data.station) && (
          <div className="mt-2 space-y-0.5 text-xs text-white/70">
            {data.scheduledAt && (
              <p>{formatShareDateTime(data.scheduledAt)}</p>
            )}
            {data.station && (
              <p className="uppercase tracking-wide text-white/50">
                {data.station}
              </p>
            )}
            {data.venue && <p>{data.venue}</p>}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-1 items-center gap-2">
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <TeamLogoOrBadge
            name={data.home.name}
            logoUrl={data.home.logoUrl}
            poolColor={data.home.poolColor}
            size="xl"
          />
          <p className="font-display text-sm font-bold uppercase text-white">
            {data.home.name}
          </p>
          {data.home.captain && (
            <>
              <CaptainPhoto
                name={data.home.captain.name}
                photoUrl={data.home.captain.photoUrl}
                poolColor={data.home.poolColor}
              />
              <p className="text-[10px] uppercase text-white/60">Captain</p>
              <p className="text-xs font-semibold text-white">
                {data.home.captain.name}
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <span className="font-display text-4xl font-black italic text-white/90">
            VS
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <TeamLogoOrBadge
            name={data.away.name}
            logoUrl={data.away.logoUrl}
            poolColor={data.away.poolColor}
            size="xl"
          />
          <p className="font-display text-sm font-bold uppercase text-white">
            {data.away.name}
          </p>
          {data.away.captain && (
            <>
              <CaptainPhoto
                name={data.away.captain.name}
                photoUrl={data.away.captain.photoUrl}
                poolColor={data.away.poolColor}
              />
              <p className="text-[10px] uppercase text-white/60">Captain</p>
              <p className="text-xs font-semibold text-white">
                {data.away.captain.name}
              </p>
            </>
          )}
        </div>
      </div>

      <p className="mt-auto text-center text-[10px] text-white/40">
        {data.tournament.name}
      </p>
    </ShareImageFrame>
  );
}

function ResultCard({ data, exportId }: { data: ResultSharePayload; exportId?: string }) {
  return (
    <ShareImageFrame tournament={data.tournament} exportId={exportId}>
      <div className="text-center">
        <p className="font-display text-2xl font-black uppercase tracking-wide text-white">
          {data.roundLabel}
        </p>
        <p className="text-xs uppercase text-white/50">Match result</p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className={`flex flex-1 flex-col items-center ${data.home.isWinner ? 'opacity-100' : 'opacity-75'}`}>
          <TeamLogoOrBadge name={data.home.name} logoUrl={data.home.logoUrl} poolColor={data.home.poolColor} size="lg" />
          <p className="mt-2 text-center text-xs font-bold uppercase text-white">
            {data.home.name}
          </p>
          {data.home.isWinner && (
            <span className="mt-1 text-[10px] font-bold uppercase text-emerald-400">
              Winner
            </span>
          )}
        </div>

        <div className="rounded-xl bg-white px-4 py-2 text-center shadow-lg">
          <p className="font-display text-4xl font-black tabular-nums text-black">
            {data.home.score ?? '—'}
            <span className="mx-1 text-2xl text-gray-400">–</span>
            {data.away.score ?? '—'}
          </p>
          {data.displayMode !== 'score' && (
            <p className="text-[10px] tabular-nums text-gray-500">
              {data.home.percent ?? '—'}% / {data.away.percent ?? '—'}%
            </p>
          )}
        </div>

        <div className={`flex flex-1 flex-col items-center ${data.away.isWinner ? 'opacity-100' : 'opacity-75'}`}>
          <TeamLogoOrBadge name={data.away.name} logoUrl={data.away.logoUrl} poolColor={data.away.poolColor} size="lg" />
          <p className="mt-2 text-center text-xs font-bold uppercase text-white">
            {data.away.name}
          </p>
          {data.away.isWinner && (
            <span className="mt-1 text-[10px] font-bold uppercase text-emerald-400">
              Winner
            </span>
          )}
        </div>
      </div>

      {(data.home.scorers.length > 0 || data.away.scorers.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-white/70">
          <div>
            {data.home.scorers.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </div>
          <div className="text-right">
            {data.away.scorers.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </div>
        </div>
      )}

      <p className="mt-auto text-center font-display text-sm font-bold text-amber-300">
        {data.isDraw ? 'Draw' : data.winner ? `${data.winner} wins` : ''}
      </p>
    </ShareImageFrame>
  );
}

function MvpCard({ data, exportId }: { data: MvpSharePayload; exportId?: string }) {
  return (
    <ShareImageFrame tournament={data.tournament} exportId={exportId}>
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
          Player of the Match
        </p>
        <p className="text-xs text-white/50">{data.roundLabel}</p>
      </div>

      <div className="relative mx-auto mt-4 flex flex-1 flex-col items-center justify-center">
        {data.player.photoUrl ? (
          <img
            src={data.player.photoUrl}
            alt={data.player.name}
            className="max-h-52 w-auto max-w-full object-contain drop-shadow-2xl"
          />
        ) : (
          <div className="flex size-40 items-center justify-center rounded-full bg-amber-500/20 text-4xl font-bold text-white">
            {data.player.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          {data.player.teamLogoUrl && (
            <img
              src={data.player.teamLogoUrl}
              alt=""
              className="mx-auto size-10 rounded-lg border border-white/30 bg-black/40 object-contain p-0.5"
            />
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="font-display text-3xl font-black uppercase text-white">
          {data.player.name}
        </p>
        <p className="text-sm text-amber-200">{data.player.teamName}</p>
        <p className="mt-2 text-xs tabular-nums text-white/60">
          MVP {data.stats.mvpScore}
          {data.stats.goals > 0 && ` · ${data.stats.goals}G`}
          {data.stats.assists > 0 && ` · ${data.stats.assists}A`}
          {data.stats.kills > 0 && ` · ${data.stats.kills}K`}
          {data.stats.rating != null && ` · ${data.stats.rating}★`}
        </p>
        <p className="mt-1 text-[10px] text-white/40">
          {data.homeTeam} {data.homeScore ?? '—'} – {data.awayScore ?? '—'}{' '}
          {data.awayTeam}
        </p>
      </div>
    </ShareImageFrame>
  );
}

function CongratsCard({ data, exportId }: { data: CongratsSharePayload; exportId?: string }) {
  const color = data.team.poolColor ?? '#e63946';

  return (
    <ShareImageFrame
      tournament={data.tournament}
      exportId={exportId}
      accentLeft={color}
      accentRight={color}
    >
      <div className="flex items-center justify-center gap-2 text-amber-300">
        <Trophy className="size-5" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
          Congratulations
        </p>
        <Trophy className="size-5" />
      </div>

      <p className="mt-1 text-center font-display text-lg font-bold uppercase text-white">
        {data.stageLabel}
      </p>

      <div className="relative mt-4 flex flex-1 flex-col items-center justify-end overflow-hidden rounded-xl">
        {data.team.teamPhotoUrl ? (
          <img
            src={data.team.teamPhotoUrl}
            alt={data.team.name}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 opacity-30"
            style={{ background: `linear-gradient(180deg, ${color}, #000)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="relative z-10 flex flex-col items-center pb-4 pt-16">
          <TeamLogoOrBadge
            name={data.team.name}
            logoUrl={data.team.logoUrl}
            poolColor={data.team.poolColor}
            size="lg"
          />
          <p className="mt-3 font-display text-2xl font-black uppercase text-white">
            {data.team.name}
          </p>
          {data.score && (
            <p className="text-sm font-bold text-emerald-400">{data.score}</p>
          )}
          {data.opponentName && (
            <p className="text-xs text-white/60">vs {data.opponentName}</p>
          )}
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] text-white/40">
        {data.tournament.name}
      </p>
    </ShareImageFrame>
  );
}

export function ShareImageCard({
  payload,
  exportId,
}: {
  payload: AnySharePayload;
  exportId?: string;
}) {
  switch (payload.type) {
    case 'prematch':
      return <PrematchCard data={payload} exportId={exportId} />;
    case 'result':
      return <ResultCard data={payload} exportId={exportId} />;
    case 'mvp':
      return <MvpCard data={payload} exportId={exportId} />;
    case 'congrats':
      return <CongratsCard data={payload} exportId={exportId} />;
  }
}

export function ShareImagesModal({
  payload,
  title,
  onClose,
}: {
  payload: AnySharePayload;
  title: string;
  onClose: () => void;
}) {
  const exportId = 'share-image-export';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
        <h3 className="font-display text-xl font-bold">{title}</h3>
        <div className="mt-4 flex justify-center">
          <ShareImageCard payload={payload} exportId={exportId} />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10]"
            onClick={async () => {
              const { downloadSharePng } = await import('./share-image-frame');
              await downloadSharePng(exportId, `${payload.type}-${Date.now()}.png`);
            }}
          >
            Download PNG
          </button>
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm text-[var(--color-muted)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
