'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

type FollowResponse = { ok: boolean; isFollowing: boolean; followers: number };

export function FollowButton({
  communityId,
  slug,
  isFollowing,
  followers,
  className,
}: {
  communityId: string;
  slug: string;
  isFollowing: boolean;
  followers: number;
  className?: string;
}) {
  const { token } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [following, setFollowing] = useState(isFollowing);
  const [count, setCount] = useState(followers);

  useEffect(() => setFollowing(isFollowing), [isFollowing]);
  useEffect(() => setCount(followers), [followers]);

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      api<FollowResponse>(`/communities/${communityId}/follow`, {
        method: next ? 'POST' : 'DELETE',
        token,
      }),
    onMutate: (next) => {
      setFollowing(next);
      setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    },
    onSuccess: (res) => {
      setFollowing(res.isFollowing);
      setCount(res.followers);
      toast.success(res.isFollowing ? 'Following community' : 'Unfollowed');
      void qc.invalidateQueries({ queryKey: ['community', slug] });
      void qc.invalidateQueries({ queryKey: ['communities-mine'] });
    },
    onError: (err, next) => {
      setFollowing(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error(err instanceof Error ? err.message : 'Could not update follow');
    },
  });

  function onClick() {
    if (!token) {
      router.push(`/login?next=/c/${slug}`);
      return;
    }
    mutation.mutate(!following);
  }

  return (
    <Button
      type="button"
      variant={following ? 'secondary' : 'primary'}
      onClick={onClick}
      disabled={mutation.isPending}
      className={cn('gap-2', className)}
      aria-pressed={following}
    >
      <Heart className={cn('size-4', following && 'fill-current')} />
      {following ? 'Following' : 'Follow'}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs',
          following ? 'bg-[var(--color-surface-hover)]' : 'bg-black/10',
        )}
      >
        {count}
      </span>
    </Button>
  );
}
