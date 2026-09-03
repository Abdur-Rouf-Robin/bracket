'use client';

import { teamColor, teamInitials } from '@/lib/team-display';
import type { ShareTournamentVisual } from '@bracket/shared';

export function ShareImageFrame({
  tournament,
  exportId,
  accentLeft,
  accentRight,
  children,
  className = '',
}: {
  tournament: ShareTournamentVisual;
  exportId?: string;
  accentLeft?: string | null;
  accentRight?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const bg = tournament.backgroundImageUrl;

  return (
    <div
      id={exportId}
      className={`relative aspect-square w-full max-w-[540px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl ${className}`}
      style={{
        background: bg
          ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url(${bg}) center/cover no-repeat`
          : 'linear-gradient(145deg, #0a1628 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      {accentLeft && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-40"
          style={{
            background: `linear-gradient(135deg, ${accentLeft} 0%, transparent 60%)`,
          }}
        />
      )}
      {accentRight && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-40"
          style={{
            background: `linear-gradient(-135deg, ${accentRight} 0%, transparent 60%)`,
          }}
        />
      )}

      {tournament.logoUrl && (
        <img
          src={tournament.logoUrl}
          alt=""
          className="absolute left-4 top-4 size-12 rounded-lg border border-white/20 bg-black/30 object-contain p-1"
        />
      )}

      <div className="relative flex h-full flex-col p-5">{children}</div>
    </div>
  );
}

export function TeamLogoOrBadge({
  name,
  logoUrl,
  poolColor,
  size = 'lg',
}: {
  name: string;
  logoUrl?: string | null;
  poolColor?: string | null;
  size?: 'md' | 'lg' | 'xl';
}) {
  const dim =
    size === 'xl' ? 'size-24' : size === 'lg' ? 'size-16' : 'size-12';
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={`${dim} rounded-xl border-2 border-white/20 bg-white/10 object-contain p-1`}
      />
    );
  }
  const bg = poolColor ?? teamColor({ name, poolColor: poolColor ?? null });
  return (
    <div
      className={`${dim} flex items-center justify-center rounded-xl border-2 border-white/20 font-display text-lg font-bold text-white`}
      style={{ backgroundColor: bg }}
    >
      {teamInitials(name)}
    </div>
  );
}

export function CaptainPhoto({
  name,
  photoUrl,
  poolColor,
}: {
  name: string;
  photoUrl?: string | null;
  poolColor?: string | null;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="mx-auto h-28 w-24 rounded-xl border-2 border-white/30 object-cover object-top shadow-lg"
      />
    );
  }
  const bg = poolColor ?? '#393e46';
  return (
    <div
      className="mx-auto flex h-28 w-24 items-end justify-center overflow-hidden rounded-xl border-2 border-white/30 pb-3 font-display text-2xl font-bold text-white shadow-lg"
      style={{ background: `linear-gradient(180deg, ${bg}88, ${bg})` }}
    >
      {teamInitials(name)}
    </div>
  );
}

export { downloadResultPng as downloadSharePng } from '@/components/match-result-view';
