'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Printer, RefreshCw } from 'lucide-react';
import { formatMoney } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import type { PublicOrderView } from '@/components/event/event-types';
import { formatEventDateRange } from '@/components/event/event-utils';
import { OrderStatusBadge } from '@/components/event/status-badge';
import { ApiError, api } from '@/lib/api';

export default function TicketPage() {
  return (
    <Suspense fallback={null}>
      <TicketPageInner />
    </Suspense>
  );
}

function TicketPageInner() {
  const params = useParams<{ slug: string; code: string }>();
  const { slug, code } = params;
  const searchParams = useSearchParams();
  const router = useRouter();
  const paidFlag = searchParams.get('paid') === '1';

  const { data: order, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['event-order', slug, code],
    queryFn: () => api<PublicOrderView>(`/e/${slug}/orders/${encodeURIComponent(code)}`, { timeoutMs: 20000 }),
    retry: 1,
    // A single lazy re-check for PENDING orders after returning from Stripe.
    refetchInterval: (q) => (paidFlag && q.state.data?.status === 'PENDING' && q.state.dataUpdateCount < 4 ? 4000 : false),
  });

  useEffect(() => {
    if (paidFlag && order?.status === 'PAID') {
      toast.success('Payment confirmed — see you there!');
      router.replace(`/e/${slug}/ticket/${code}`);
    }
  }, [paidFlag, order?.status, router, slug, code]);

  const statusHint: Record<string, string> = {
    PAID: 'Show this at check-in.',
    PENDING: 'Payment pending. If you paid at the door, the organizer will confirm at check-in.',
    REFUNDED: 'This ticket has been refunded and is no longer valid.',
    CANCELLED: 'This ticket has been cancelled.',
  };

  return (
    <div className="min-h-screen">
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main className="mx-auto max-w-2xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
        {isLoading && <div className="gaming-card h-96 animate-pulse rounded-3xl" />}

        {error && (
          <div className="panel-card rounded-3xl px-6 py-16 text-center">
            <h1 className="text-2xl font-bold text-[var(--color-ink)]">
              {error instanceof ApiError && error.status === 404 ? 'Ticket not found' : 'Could not load ticket'}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Check the code in your confirmation email.
            </p>
            <Link href={`/e/${slug}`} className="mt-6 inline-block">
              <Button variant="secondary">Back to event</Button>
            </Link>
          </div>
        )}

        {order && (
          <>
            <div className="mb-4 flex items-center justify-between print:hidden">
              <Link href={`/e/${slug}`} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                ← {order.event.name}
              </Link>
              <div className="flex gap-2">
                <Button variant="ghost" className="gap-2" onClick={() => void refetch()} disabled={isFetching}>
                  <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Refresh
                </Button>
                <Button variant="secondary" className="gap-2" onClick={() => window.print()}>
                  <Printer className="size-4" /> Print
                </Button>
              </div>
            </div>

            <article className="gaming-card overflow-hidden rounded-3xl print:border print:border-black print:bg-white print:text-black">
              <div className="relative h-32 bg-[var(--color-surface)] print:hidden">
                {order.event.bannerUrl ? (
                  <img src={order.event.bannerUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="size-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_40%,transparent),color-mix(in_srgb,var(--color-accent-glow)_40%,transparent))]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-card)] to-transparent" />
              </div>

              <div className="grid gap-8 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {order.event.logoUrl && (
                      <img src={order.event.logoUrl} alt="" className="size-12 rounded-xl border border-[var(--color-line)] object-cover print:hidden" />
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)] print:text-black">
                        Admission ticket
                      </p>
                      <h1 className="text-2xl font-bold text-[var(--color-ink)] print:text-black">{order.event.name}</h1>
                    </div>
                  </div>

                  <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Ticket</dt>
                      <dd className="mt-0.5 font-medium text-[var(--color-ink)] print:text-black">
                        {order.ticket.name} × {order.quantity}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Attendee</dt>
                      <dd className="mt-0.5 font-medium text-[var(--color-ink)] print:text-black">{order.buyerName}</dd>
                      <dd className="text-xs text-[var(--color-muted)]">{order.buyerEmail}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Amount</dt>
                      <dd className="mt-0.5 font-medium text-[var(--color-ink)] print:text-black">
                        {formatMoney(order.amountCents, order.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Status</dt>
                      <dd className="mt-1">
                        <OrderStatusBadge status={order.status} />
                        {order.checkedInAt && (
                          <span className="ml-2 text-xs text-[var(--color-ok)]">Checked in</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6 space-y-1.5 text-sm text-[var(--color-muted)]">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="size-4 shrink-0" />
                      {formatEventDateRange(order.event.startAt, order.event.endAt, order.event.timezone, { withZone: true })}
                    </p>
                    {(order.event.venueName || order.event.venueAddress) && (
                      <p className="flex items-center gap-2">
                        <MapPin className="size-4 shrink-0" />
                        {[order.event.venueName, order.event.venueAddress].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-5 print:border-black print:bg-white">
                  <div className="rounded-xl bg-white p-3">
                    <QRCodeSVG value={order.code} size={160} level="M" marginSize={0} />
                  </div>
                  <p className="font-mono text-2xl font-bold tracking-[0.3em] text-[var(--color-ink)] print:text-black">
                    {order.code}
                  </p>
                  <p className="text-center text-xs text-[var(--color-muted)]">{statusHint[order.status]}</p>
                </div>
              </div>
            </article>

            {order.status === 'PENDING' && (
              <p className="mt-4 text-center text-xs text-[var(--color-muted)] print:hidden">
                Paid already? It can take a moment for the payment to register — use Refresh.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
