'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { streamProvider, toStreamEmbedUrl } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { EventDetail } from '../event-types';
import { StreamEmbed } from '../stream-embed';

export function ManageStream({ event }: { event: EventDetail }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [url, setUrl] = useState(event.streamUrl ?? '');

  const embeddable = !!toStreamEmbedUrl(url, { parentHost: 'localhost' });
  const provider = streamProvider(url);
  const dirty = (url.trim() || null) !== (event.streamUrl ?? null);

  const save = useMutation({
    mutationFn: () =>
      api<EventDetail>(`/events/${event.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ streamUrl: url.trim() || null }),
      }),
    onSuccess: () => {
      toast.success('Stream saved');
      void qc.invalidateQueries({ queryKey: ['event', event.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <form
        className="panel-card space-y-4 rounded-2xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <Label htmlFor="stream-url">Stream URL</Label>
          <Input
            id="stream-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://twitch.tv/channel"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {url.trim()
              ? embeddable
                ? `Embeds a ${provider === 'twitch' ? 'Twitch' : 'YouTube'} player on the event page.`
                : 'Not a recognised YouTube/Twitch link — shown as an external “Watch” button.'
              : 'Supported: youtube.com/watch, youtu.be, youtube.com/live, twitch.tv/channel, twitch.tv/videos.'}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          {event.streamUrl && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setUrl('')}
            >
              Clear
            </Button>
          )}
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Live preview</p>
        {url.trim() ? (
          <StreamEmbed url={url.trim()} title="Stream preview" />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-[var(--color-line)] text-sm text-[var(--color-muted)]">
            Paste a stream link to preview it here.
          </div>
        )}
      </div>
    </div>
  );
}
