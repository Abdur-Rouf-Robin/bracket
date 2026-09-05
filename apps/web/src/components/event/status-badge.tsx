import { cn } from '@/lib/utils';
import {
  ORDER_STATUS_STYLES,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_STYLES,
} from './event-utils';

export function OrderStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        ORDER_STATUS_STYLES[status] ?? ORDER_STATUS_STYLES.REFUNDED,
        className,
      )}
    >
      {status}
    </span>
  );
}

export function TournamentStatusChip({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        TOURNAMENT_STATUS_STYLES[status] ?? TOURNAMENT_STATUS_STYLES.DRAFT,
        className,
      )}
    >
      {TOURNAMENT_STATUS_LABEL[status] ?? status}
    </span>
  );
}
