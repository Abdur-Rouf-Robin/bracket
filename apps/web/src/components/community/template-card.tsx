'use client';

import Link from 'next/link';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommunityTemplate } from './types';

function describePayload(payload: Record<string, unknown>): string[] {
  const bits: string[] = [];
  const format = payload.format;
  const settings = (payload.settings ?? {}) as Record<string, unknown>;
  if (typeof format === 'string' && format) bits.push(format.replaceAll('_', ' '));
  else if (typeof settings.stageMode === 'string') bits.push(String(settings.stageMode).replaceAll('_', ' '));
  if (typeof payload.gameName === 'string' && payload.gameName) bits.push(payload.gameName);
  if (typeof payload.teamCount === 'number') bits.push(`${payload.teamCount} teams`);
  if (typeof payload.venueType === 'string' && payload.venueType) {
    bits.push(payload.venueType === 'ONLINE' ? 'Online' : 'In person');
  }
  return bits;
}

export function TemplateCard({
  template,
  communityId,
  canEdit,
  onEdit,
  onDelete,
}: {
  template: CommunityTemplate;
  communityId?: string | null;
  canEdit?: boolean;
  onEdit?: (t: CommunityTemplate) => void;
  onDelete?: (t: CommunityTemplate) => void;
}) {
  const bits = describePayload(template.payload ?? {});
  const useHref = `/tournaments/new?template=${template.id}${
    communityId ?? template.communityId
      ? `&community=${communityId ?? template.communityId}`
      : ''
  }`;
  return (
    <div className="panel-card flex flex-col rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold">{template.name}</h3>
          {template.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-muted)]">
              {template.description}
            </p>
          )}
        </div>
      </div>
      {bits.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {bits.map((b) => (
            <span
              key={b}
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] capitalize text-[var(--color-muted)]"
            >
              {b}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="text-xs text-[var(--color-muted)]">
          Used {template.usageCount} {template.usageCount === 1 ? 'time' : 'times'}
          {template.community ? ` · ${template.community.name}` : ''}
        </span>
        <div className="flex items-center gap-1">
          {canEdit && onEdit && (
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1"
              title="Edit"
              onClick={() => onEdit(template)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {canEdit && onDelete && (
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 hover:text-[var(--color-danger)]"
              title="Delete"
              onClick={() => onDelete(template)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Link href={useHref}>
            <Button type="button" variant="secondary" className="py-1.5 text-xs">
              Use template
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
