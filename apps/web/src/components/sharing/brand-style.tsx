'use client';

import type { CSSProperties, ReactNode } from 'react';
import { isHexColor } from '@bracket/shared';
import type { Tournament } from '@/lib/types';

export type BrandSettings = {
  brandPrimaryColor?: string | null;
  brandSecondaryColor?: string | null;
  hideBranding?: boolean;
};

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function darken(hex: string, amount = 0.18): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb.map((c) => Math.max(0, Math.round(c * (1 - amount))));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Readable text color (dark/light) for a given background. */
export function contrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#041018';
  const [r, g, b] = rgb;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#041018' : '#ffffff';
}

/**
 * Inline CSS variable overrides derived from tournament branding settings.
 * Apply to a wrapper element on the public tournament page, e.g.
 *   <div style={tournamentBrandStyle(tournament)}>…</div>
 * so existing `var(--color-accent)` usages pick up the organizer's colors.
 */
export function tournamentBrandStyle(
  tournament: Pick<Tournament, 'settings'> | null | undefined,
): CSSProperties {
  const s = (tournament?.settings ?? {}) as BrandSettings;
  const style: Record<string, string> = {};
  if (isHexColor(s.brandPrimaryColor)) {
    style['--color-accent'] = s.brandPrimaryColor;
    style['--color-accent-deep'] = darken(s.brandPrimaryColor);
    style['--brand-primary-contrast'] = contrastText(s.brandPrimaryColor);
  }
  if (isHexColor(s.brandSecondaryColor)) {
    style['--color-accent-secondary'] = s.brandSecondaryColor;
    style['--brand-secondary'] = s.brandSecondaryColor;
  }
  return style as CSSProperties;
}

/**
 * Wrapper component variant of `tournamentBrandStyle` — wrap the public
 * tournament page content so brand colors cascade to children.
 */
export function TournamentBrandStyle({
  tournament,
  children,
  className,
  as: Tag = 'div',
}: {
  tournament: Pick<Tournament, 'settings'> | null | undefined;
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'main';
}) {
  return (
    <Tag className={className} style={tournamentBrandStyle(tournament)}>
      {children}
    </Tag>
  );
}

/** Whether "Powered by Bracket" chrome should be hidden. */
export function shouldHideBranding(
  tournament: Pick<Tournament, 'settings' | 'viewerPlan'> | null | undefined,
): boolean {
  const s = (tournament?.settings ?? {}) as BrandSettings;
  return !!s.hideBranding;
}
