'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  CreditCard,
  ListOrdered,
  MessageSquare,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AppNotification } from '@/lib/types-platform';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type InboxResponse = {
  items: AppNotification[];
  unreadCount: number;
  nextCursor: string | null;
};

function iconFor(type: string) {
  if (type.startsWith('registration_approved')) return UserCheck;
  if (type.startsWith('registration_rejected') || type.includes('withdrawn')) return UserX;
  if (type.startsWith('registration_waitlisted')) return ListOrdered;
  if (type.startsWith('registration')) return ClipboardCheck;
  if (type.startsWith('match_comment')) return MessageSquare;
  if (type.includes('payment') || type.includes('billing')) return CreditCard;
  return Bell;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function InboxList({
  compact = false,
  pageSize = 30,
}: {
  compact?: boolean;
  pageSize?: number;
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['inbox', { unreadOnly, pageSize }],
    enabled: !!token,
    initialPageParam: null as string | null,
    getNextPageParam: (last: InboxResponse) => last.nextCursor ?? undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (unreadOnly) params.set('unread', '1');
      params.set('limit', String(pageSize));
      if (pageParam) params.set('cursor', pageParam);
      return api<InboxResponse>(`/inbox?${params.toString()}`, { token });
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['inbox'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/inbox/${id}/read`, { method: 'PATCH', token }),
    onSuccess: invalidateAll,
  });
  const markAll = useMutation({
    mutationFn: () => api('/inbox/read-all', { method: 'POST', token }),
    onSuccess: () => {
      toast.success('All notifications marked as read');
      invalidateAll();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/inbox/${id}`, { method: 'DELETE', token }),
    onSuccess: invalidateAll,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = query.data?.pages[0]?.unreadCount ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            className={cn('choice-btn rounded-full px-3 py-1 text-xs', !unreadOnly && 'choice-btn-active')}
            onClick={() => setUnreadOnly(false)}
          >
            All
          </button>
          <button
            type="button"
            className={cn('choice-btn rounded-full px-3 py-1 text-xs', unreadOnly && 'choice-btn-active')}
            onClick={() => setUnreadOnly(true)}
          >
            Unread{unread ? ` (${unread})` : ''}
          </button>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="ml-auto h-8 text-xs"
          disabled={!unread || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="mr-1 size-3.5" /> Mark all read
        </Button>
      </div>

      {query.isLoading && !items.length ? (
        <p className="text-sm text-[var(--color-muted)]">Loading notifications…</p>
      ) : items.length === 0 ? (
        <div className="gaming-card rounded-xl border-dashed p-8 text-center text-sm text-[var(--color-muted)]">
          <Bell className="mx-auto mb-2 size-6 opacity-60" />
          {unreadOnly ? 'No unread notifications.' : 'Nothing here yet. Registration updates and match comments will show up here.'}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)]">
          {items.map((n) => {
            const Icon = iconFor(n.type);
            const isUnread = !n.readAt;
            const body = (
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                    isUnread
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-muted)]',
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', isUnread ? 'font-semibold' : 'font-medium')}>
                    {n.title}
                  </span>
                  {n.body && !compact && (
                    <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{n.body}</span>
                  )}
                  <span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">
                    {relativeTime(n.createdAt)}
                  </span>
                </span>
              </div>
            );
            return (
              <li
                key={n.id}
                className={cn(
                  'flex items-start gap-2 px-4 py-3 transition',
                  isUnread ? 'bg-[var(--color-accent)]/5' : 'bg-transparent',
                )}
              >
                {n.href ? (
                  <Link
                    href={n.href}
                    className="flex min-w-0 flex-1"
                    onClick={() => {
                      if (isUnread) markRead.mutate(n.id);
                    }}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1">{body}</div>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {isUnread && (
                    <button
                      type="button"
                      className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                      title="Mark as read"
                      onClick={() => markRead.mutate(n.id)}
                    >
                      <CheckCheck className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                    title="Delete"
                    onClick={() => remove.mutate(n.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            className="h-8 text-xs"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
