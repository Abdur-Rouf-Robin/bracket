'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { COMMUNITY_ROLE_DESCRIPTIONS } from '@bracket/shared';
import { MemberTable } from '@/components/community/member-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community, CommunityMember, CommunityRole } from '@/lib/types-platform';

type Assignable = Exclude<CommunityRole, 'OWNER'>;

export function ManageCommunityMembers({ community }: { community: Community }) {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Assignable>('AFFILIATE');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const isOwner = community.ownerId === user?.id;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['community-members', community.id],
    queryFn: () =>
      api<CommunityMember[]>(`/communities/${community.id}/members`, { token: token ?? undefined }),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community-members', community.id] });
    void qc.invalidateQueries({ queryKey: ['community', community.slug] });
  }

  const add = useMutation({
    mutationFn: () =>
      api(`/communities/${community.id}/members`, {
        method: 'POST',
        token,
        body: JSON.stringify({ email: email.trim(), role }),
      }),
    onSuccess: () => {
      toast.success('Member added');
      setEmail('');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not add member'),
  });

  const changeRole = useMutation({
    mutationFn: ({ member, next }: { member: CommunityMember; next: Assignable }) =>
      api(`/communities/${community.id}/members/${member.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ role: next }),
      }),
    onMutate: ({ member }) => setPendingId(member.id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      toast.success('Role updated');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update role'),
  });

  const remove = useMutation({
    mutationFn: (member: CommunityMember) =>
      api(`/communities/${community.id}/members/${member.id}`, { method: 'DELETE', token }),
    onMutate: (member) => setPendingId(member.id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      toast.success('Member removed');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not remove'),
  });

  const transfer = useMutation({
    mutationFn: (member: CommunityMember) =>
      api(`/communities/${community.id}/transfer-ownership`, {
        method: 'POST',
        token,
        body: JSON.stringify({ userId: member.user.id }),
      }),
    onMutate: (member) => setPendingId(member.id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      toast.success('Ownership transferred');
      refresh();
      void qc.invalidateQueries({ queryKey: ['community', community.slug] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Transfer failed'),
  });

  return (
    <div className="space-y-8">
      <section className="panel-card space-y-4 rounded-2xl p-5">
        <h3 className="font-display text-lg font-bold">Invite a member</h3>
        <p className="text-sm text-[var(--color-muted)]">
          They must already have a Bracket account. Roles: admin (settings & members),
          collaborator (tournaments & announcements), affiliate (create tournaments).
        </p>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_160px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) add.mutate();
          }}
        >
          <div>
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="organizer@example.com"
              required
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select
              value={role}
              onChange={(v) => setRole(v as Assignable)}
              options={[
                { value: 'ADMIN', label: 'Admin' },
                { value: 'COLLABORATOR', label: 'Collaborator' },
                { value: 'AFFILIATE', label: 'Affiliate' },
              ]}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={add.isPending || !email.trim()}>
              {add.isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
        <p className="text-xs text-[var(--color-muted)]">{COMMUNITY_ROLE_DESCRIPTIONS[role]}</p>
      </section>

      {isLoading ? (
        <div className="panel-card h-40 animate-pulse rounded-xl" />
      ) : (
        <MemberTable
          members={members}
          canManage
          currentUserId={user?.id}
          isOwner={isOwner}
          pendingId={pendingId}
          onChangeRole={(member, next) => changeRole.mutate({ member, next })}
          onRemove={(member) => {
            if (confirm(`Remove ${member.user.name} from this community?`)) remove.mutate(member);
          }}
          onTransfer={(member) => {
            if (
              confirm(
                `Transfer ownership to ${member.user.name}? You will become an admin.`,
              )
            ) {
              transfer.mutate(member);
            }
          }}
        />
      )}
    </div>
  );
}
