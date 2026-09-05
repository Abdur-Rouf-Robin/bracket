'use client';

import { useState } from 'react';
import { Pin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CommunityAnnouncement } from '@/lib/types-platform';
import { cn } from '@/lib/utils';
import { formatDateTime } from './types';

export function AnnouncementList({
  announcements,
  canManage,
  onTogglePin,
  onDelete,
  emptyText = 'No announcements yet.',
  compact,
}: {
  announcements: CommunityAnnouncement[];
  canManage?: boolean;
  onTogglePin?: (a: CommunityAnnouncement) => void;
  onDelete?: (a: CommunityAnnouncement) => void;
  emptyText?: string;
  compact?: boolean;
}) {
  if (announcements.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {announcements.map((a) => (
        <li
          key={a.id}
          className={cn(
            'panel-card rounded-xl px-4 py-3',
            a.pinned && 'border-[var(--color-accent)]/40',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {a.pinned && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                    <Pin className="size-3" /> Pinned
                  </span>
                )}
                <h3 className="font-display text-base font-bold">{a.title}</h3>
              </div>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {a.author?.name ? `${a.author.name} · ` : ''}
                {formatDateTime(a.createdAt)}
              </p>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-1">
                {onTogglePin && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1"
                    title={a.pinned ? 'Unpin' : 'Pin'}
                    onClick={() => onTogglePin(a)}
                  >
                    <Pin className={cn('size-4', a.pinned && 'fill-current')} />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 hover:text-[var(--color-danger)]"
                    title="Delete"
                    onClick={() => onDelete(a)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <p
            className={cn(
              'mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink)]/90',
              compact && 'line-clamp-3',
            )}
          >
            {a.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AnnouncementForm({
  onSubmit,
  pending,
  initial,
  submitLabel = 'Post announcement',
}: {
  onSubmit: (input: { title: string; body: string; pinned: boolean }) => Promise<void> | void;
  pending?: boolean;
  initial?: { title?: string; body?: string; pinned?: boolean };
  submitLabel?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);

  return (
    <form
      className="panel-card space-y-3 rounded-xl p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !body.trim()) return;
        await onSubmit({ title: title.trim(), body: body.trim(), pinned });
        if (!initial) {
          setTitle('');
          setBody('');
          setPinned(false);
        }
      }}
    >
      <div>
        <Label htmlFor="ann-title">Title</Label>
        <Input
          id="ann-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's new?"
          maxLength={160}
          required
        />
      </div>
      <div>
        <Label htmlFor="ann-body">Message</Label>
        <textarea
          id="ann-body"
          className="field-textarea min-h-[120px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share updates with followers and members. They'll get a notification."
          maxLength={8000}
          required
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-accent)]"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          Pin to top
        </label>
        <Button type="submit" disabled={pending || !title.trim() || !body.trim()}>
          {pending ? 'Posting…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
