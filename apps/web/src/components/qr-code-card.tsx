'use client';

import { useCallback, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Client-rendered QR code with PNG download + copy-URL actions. Server
 * equivalents live at `/t/:slug/qr.png|svg` and `/t/:slug/qr-poster.pdf`.
 */
export function QrCodeCard({
  url,
  title,
  caption = 'Scan to follow live results',
  size = 200,
  filename = 'qr-code',
  pdfHref,
  className,
  dark = false,
}: {
  url: string;
  title?: string;
  caption?: string;
  size?: number;
  filename?: string;
  /** Optional link to the printable A4 poster PDF. */
  pdfHref?: string;
  className?: string;
  dark?: boolean;
}) {
  const svgRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const downloadPng = useCallback(async () => {
    const svg = svgRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const src = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('QR render failed'));
        img.src = src;
      });
      const scale = 4;
      const canvas = document.createElement('canvas');
      canvas.width = size * scale;
      canvas.height = size * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${filename}.png`;
      a.click();
    } finally {
      URL.revokeObjectURL(src);
    }
  }, [filename, size]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl p-5 text-center',
        dark ? 'bg-white text-[#0a0c10]' : 'gaming-card',
        className,
      )}
    >
      {title && <p className="font-display text-base font-bold">{title}</p>}
      <div ref={svgRef} className="rounded-xl bg-white p-3">
        <QRCodeSVG value={url} size={size} level="M" marginSize={0} />
      </div>
      <p className={cn('text-xs', dark ? 'text-[#4b5563]' : 'text-[var(--color-muted)]')}>{caption}</p>
      <p className="max-w-full truncate font-mono text-[11px] text-[var(--color-accent)]">{url}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="secondary" onClick={downloadPng} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> PNG
        </Button>
        {pdfHref && (
          <a
            href={pdfHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent)]/40"
          >
            <Download className="h-3.5 w-3.5" /> Poster PDF
          </a>
        )}
        <Button type="button" variant="ghost" onClick={copy} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
    </div>
  );
}
