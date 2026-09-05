'use client';

import { Crown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommunityMember, CommunityRole } from '@/lib/types-platform';
import { RoleBadge } from './role-badge';
import { formatDate, initialsOf } from './types';

const ASSIGNABLE: Exclude<CommunityRole, 'OWNER'>[] = ['ADMIN', 'COLLABORATOR', 'AFFILIATE'];

export function MemberTable({
  members,
  canManage,
  currentUserId,
  isOwner,
  onChangeRole,
  onRemove,
  onTransfer,
  pendingId,
}: {
  members: CommunityMember[];
  canManage?: boolean;
  currentUserId?: string | null;
  isOwner?: boolean;
  onChangeRole?: (member: CommunityMember, role: Exclude<CommunityRole, 'OWNER'>) => void;
  onRemove?: (member: CommunityMember) => void;
  onTransfer?: (member: CommunityMember) => void;
  pendingId?: string | null;
}) {
  if (members.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
        No members yet.
      </p>
    );
  }
  return (
    <div className="panel-card overflow-x-auto rounded-xl">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
            <th className="px-3 py-2.5 font-semibold">Member</th>
            <th className="px-3 py-2.5 font-semibold">Role</th>
            <th className="px-3 py-2.5 font-semibold">Joined</th>
            {canManage && <th className="px-3 py-2.5 text-right font-semibold">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isMemberOwner = m.role === 'OWNER';
            const busy = pendingId === m.id;
            return (
              <tr key={m.id} className="border-b border-[var(--color-line)]/60 last:border-0">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface)] text-xs font-bold">
                      {m.user.avatarUrl ? (
                        <img src={m.user.avatarUrl} alt="" className="size-full object-cover" />
                      ) : (
                        initialsOf(m.user.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {m.user.name}
                        {m.user.id === currentUserId && (
                          <span className="ml-1 text-xs text-[var(--color-muted)]">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {m.user.email ?? (m.user.username ? `@${m.user.username}` : '')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {canManage && !isMemberOwner && onChangeRole ? (
                    <select
                      className="field-select w-auto py-1 text-xs"
                      value={m.role}
                      disabled={busy}
                      onChange={(e) =>
                        onChangeRole(m, e.target.value as Exclude<CommunityRole, 'OWNER'>)
                      }
                    >
                      {ASSIGNABLE.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0) + r.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-[var(--color-muted)]">
                  {formatDate(m.createdAt)}
                </td>
                {canManage && (
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isOwner && !isMemberOwner && onTransfer && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 py-1"
                          title="Transfer ownership"
                          disabled={busy}
                          onClick={() => onTransfer(m)}
                        >
                          <Crown className="size-4" />
                        </Button>
                      )}
                      {!isMemberOwner && onRemove && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 py-1 hover:text-[var(--color-danger)]"
                          title="Remove"
                          disabled={busy}
                          onClick={() => onRemove(m)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
