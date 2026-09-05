'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AppNotification } from '@/lib/types-platform';
import { cn } from '@/lib/utils';

type InboxResponse = { items: AppNotification[]; unreadCount: number };

const POLL_MS = 60_000;

function relTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Header notification bell. Talks to the inbox API contract:
 *   GET  /inbox?unread=1&limit=20 → { items, unreadCount }
 *   PATCH /inbox/:id/read
 *   POST /inbox/read-all
 * Renders nothing when logged out, and degrades to an empty state if the
 * endpoints are not available yet.
 */
export function NotificationBell({ className }: { className?: string }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isError } = useQuery({
    queryKey: ['inbox', 'bell'],
    enabled: !!token,
    refetchInterval: POLL_MS,
    retry: 0,
    queryFn: async () => {
      try {
        const res = await api<InboxResponse | AppNotification[]>(
          '/inbox?unread=1&limit=20',
          { token },
        );
        if (Array.isArray(res)) {
          return {
            items: res,
            unreadCount: res.filter((n) => !n.readAt).length,
          } satisfies InboxResponse;
        }
        return {
          items: res?.items ?? [],
          unreadCount: res?.unreadCount ?? 0,
        } satisfies InboxResponse;
      } catch {
        return { items: [], unreadCount: 0 } satisfies InboxResponse;
      }
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api(`/inbox/${id}/read`, { method: 'PATCH', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });

  const markAll = useMutation({
    mutationFn: () => api('/inbox/read-all', { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });

  if (!token) return null;

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  function open(n: AppNotification) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.href) router.push(n.href);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
          className={cn('relative', className)}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold leading-4 text-[var(--color-accent-fg)] ring-2 ring-[var(--color-paper)]">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2">
          <p className="font-display text-sm font-bold">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[22rem] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[var(--color-muted)]">
              <Inbox className="size-6 opacity-60" aria-hidden />
              {isError ? 'Inbox unavailable right now.' : "You're all caught up."}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--color-surface)]',
                      !n.readAt && 'bg-[var(--color-accent)]/5',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        n.readAt ? 'bg-transparent ring-1 ring-[var(--color-line-strong)]' : 'bg-[var(--color-accent)]',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{n.title}</span>
                      {n.body && (
                        <span className="mt-0.5 block line-clamp-2 text-xs text-[var(--color-muted)]">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
                        {relTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-[var(--color-line)] p-2">
          <Link
            href="/inbox"
            className="block rounded-md px-3 py-1.5 text-center text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-surface)]"
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
