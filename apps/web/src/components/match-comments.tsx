'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/account/avatar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { MatchComment } from '@/lib/types-platform';

type CommentsResponse = {
  enabled: boolean;
  canManage: boolean;
  items: MatchComment[];
};

const MAX_LEN = 2000;

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function MatchComments({
  matchId,
  enabled,
  className,
}: {
  matchId: string;
  /** From tournament settings — when false the section renders a disabled notice. */
  enabled: boolean;
  className?: string;
}) {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const query = useQuery({
    queryKey: ['match-comments', matchId, token ?? 'anon'],
    enabled,
    queryFn: () =>
      api<CommentsResponse>(`/matches/${matchId}/comments`, { token: token ?? undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['match-comments', matchId] });

  const post = useMutation({
    mutationFn: () =>
      api<MatchComment>(`/matches/${matchId}/comments`, {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ body: body.trim() }),
      }),
    onSuccess: () => {
      setBody('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (commentId: string) =>
      api(`/matches/${matchId}/comments/${commentId}`, { method: 'DELETE', token: token! }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!enabled) {
    return (
      <section className={className}>
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="size-4" /> Comments
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          The host has disabled match comments for this tournament.
        </p>
      </section>
    );
  }

  const items = query.data?.items ?? [];
  const canManage = query.data?.canManage ?? false;
  const remaining = MAX_LEN - body.length;

  return (
    <section className={className}>
      <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="size-4" /> Comments
        {items.length > 0 && (
          <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
            {items.length}
          </span>
        )}
      </h2>

      <div className="mt-3 space-y-3">
        {query.isLoading && <p className="text-sm text-[var(--color-muted)]">Loading comments…</p>}
        {query.error && (
          <p className="text-sm text-red-500">
            {query.error instanceof Error ? query.error.message : 'Could not load comments'}
          </p>
        )}
        {!query.isLoading && items.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">No comments yet. Start the conversation.</p>
        )}
        {items.map((c) => {
          const own = user?.id === c.user.id;
          return (
            <article key={c.id} className="panel-card flex gap-3 rounded-xl p-3">
              <Avatar name={c.user.name} src={c.user.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2 text-xs">
                  {c.user.username ? (
                    <Link
                      href={`/u/${c.user.username}`}
                      className="font-semibold text-[var(--color-ink)] hover:underline"
                    >
                      {c.user.name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-[var(--color-ink)]">{c.user.name}</span>
                  )}
                  <time className="text-[var(--color-muted)]" dateTime={c.createdAt}>
                    {relativeTime(c.createdAt)}
                  </time>
                  {(own || canManage) && (
                    <button
                      type="button"
                      className="ml-auto inline-flex items-center gap-1 text-[var(--color-muted)] hover:text-red-500"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm('Delete this comment?')) remove.mutate(c.id);
                      }}
                      aria-label="Delete comment"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
            </article>
          );
        })}
      </div>

      {user && token ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim() || body.length > MAX_LEN) return;
            post.mutate();
          }}
        >
          <textarea
            className="field-textarea min-h-[80px] w-full text-sm"
            placeholder="Write a comment…"
            value={body}
            maxLength={MAX_LEN}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && body.trim()) {
                e.preventDefault();
                post.mutate();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] ${remaining < 100 ? 'text-amber-500' : 'text-[var(--color-muted)]'}`}
            >
              {remaining} characters left
            </span>
            <Button type="submit" className="h-8 text-xs" disabled={post.isPending || !body.trim()}>
              {post.isPending ? 'Posting…' : 'Post comment'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            Log in
          </Link>{' '}
          to join the discussion.
        </p>
      )}
    </section>
  );
}
