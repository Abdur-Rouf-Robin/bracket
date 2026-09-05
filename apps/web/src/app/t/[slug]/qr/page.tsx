'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { QrCodeCard } from '@/components/qr-code-card';
import { webOrigin } from '@/components/sharing/panel-kit';
import { shouldHideBranding } from '@/components/sharing/brand-style';
import { Button } from '@/components/ui/button';

/** Poster-like page: big QR to the public tournament page + download links. */
export default function QrPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api<Tournament>(`/t/${slug}`),
  });
  const url = `${webOrigin()}/t/${slug}`;
  const hideBranding = shouldHideBranding(data);

  return (
    <div className="min-h-screen bg-white text-[#0a0c10]">
      <style dangerouslySetInnerHTML={{ __html: '@page{size:A4;margin:14mm}@media print{.no-print{display:none!important}}' }} />
      <div className="no-print mx-auto flex max-w-3xl items-center justify-between px-6 py-4 text-sm">
        <Link href={`/t/${slug}`} className="text-[#0369a1] hover:underline">← Back to tournament</Link>
        <div className="flex gap-2">
          <a href={`${API_URL}/t/${slug}/qr.png?size=1024`} download className="inline-flex items-center gap-1.5 rounded-md border border-[#ddd] px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> PNG</a>
          <a href={`${API_URL}/t/${slug}/qr.svg`} download className="inline-flex items-center gap-1.5 rounded-md border border-[#ddd] px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> SVG</a>
          <a href={`${API_URL}/t/${slug}/qr-poster.pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-[#ddd] px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> Poster PDF</a>
          <Button type="button" onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-16 pt-6 text-center">
        {data?.logoUrl && <img src={data.logoUrl} alt="" className="mb-4 h-24 w-24 rounded-2xl object-cover" />}
        <p className="text-sm uppercase tracking-[0.3em] text-[#6b7280]">Follow live</p>
        <h1 className="font-display mt-2 text-5xl font-bold leading-tight">{data?.name ?? '…'}</h1>
        {data?.game?.name && <p className="mt-1 text-lg text-[#6b7280]">{data.game.name}{data.startAt ? ` · ${new Date(data.startAt).toLocaleDateString(undefined, { dateStyle: 'long' })}` : ''}</p>}
        <div className="my-10 rounded-3xl border-8 border-[#0a0c10] p-6">
          <QRCodeSVG value={url} size={360} level="M" marginSize={0} />
        </div>
        <p className="text-2xl font-semibold">Scan to follow live results</p>
        <p className="mt-2 font-mono text-lg text-[#0369a1]">{url.replace(/^https?:\/\//, '')}</p>
        <p className="mt-6 max-w-md text-sm text-[#6b7280]">Brackets, standings, schedule and results update in real time.</p>
        {!hideBranding && <p className="mt-16 text-xs text-[#9ca3af]">Powered by Bracket</p>}

        <div className="no-print mt-16 w-full max-w-sm">
          <QrCodeCard url={url} title="Compact card" size={160} filename={`${slug}-qr`} dark />
        </div>
      </main>
    </div>
  );
}
