'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TemplateCard } from '@/components/community/template-card';
import type { CommunityTemplate, CommunityTournamentCard } from '@/components/community/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community } from '@/lib/types-platform';

export function ManageCommunityTemplates({ community }: { community: Community }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [tournamentId, setTournamentId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<CommunityTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['community-templates', community.id],
    queryFn: async () => {
      const mine = await api<CommunityTemplate[]>('/templates', { token });
      return mine.filter((t) => t.communityId === community.id);
    },
  });

  const { data: tournaments = [] } = useQuery({
    queryKey: ['community-tournaments', community.id],
    queryFn: () =>
      api<CommunityTournamentCard[]>(`/communities/${community.id}/tournaments`, {
        token: token ?? undefined,
      }),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community-templates', community.id] });
    void qc.invalidateQueries({ queryKey: ['community', community.slug] });
    void qc.invalidateQueries({ queryKey: ['templates'] });
  }

  const create = useMutation({
    mutationFn: () =>
      api(`/templates/from-tournament/${tournamentId}`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          communityId: community.id,
        }),
      }),
    onSuccess: () => {
      toast.success('Template saved');
      setName('');
      setDescription('');
      setTournamentId('');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save template'),
  });

  const update = useMutation({
    mutationFn: () =>
      api(`/templates/${editing!.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success('Template updated');
      setEditing(null);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/templates/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Template deleted');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete'),
  });

  return (
    <div className="space-y-8">
      <section className="panel-card space-y-4 rounded-2xl p-5">
        <h3 className="font-display text-lg font-bold">Save from a tournament</h3>
        <p className="text-sm text-[var(--color-muted)]">
          Format, scoring, registration and branding are stored. Participants are not.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (tournamentId && name.trim()) create.mutate();
          }}
        >
          <div>
            <Label>Tournament</Label>
            <Select
              value={tournamentId}
              onChange={(id) => {
                setTournamentId(id);
                const t = tournaments.find((x) => x.id === id);
                if (t && !name.trim()) setName(`${t.name} template`);
              }}
              placeholder={tournaments.length ? 'Pick a tournament' : 'No community tournaments yet'}
              options={tournaments.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </div>
          <div>
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="tpl-desc">Description (optional)</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={create.isPending || !tournamentId || !name.trim()}>
            {create.isPending ? 'Saving…' : 'Save template'}
          </Button>
        </form>
      </section>

      {editing && (
        <section className="panel-card space-y-3 rounded-2xl p-5">
          <h3 className="font-display text-lg font-bold">Edit template</h3>
          <div>
            <Label htmlFor="tpl-edit-name">Name</Label>
            <Input
              id="tpl-edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="tpl-edit-desc">Description</Label>
            <Input
              id="tpl-edit-desc"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={update.isPending || !editName.trim()}
              onClick={() => update.mutate()}
            >
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="panel-card h-32 animate-pulse rounded-xl" />
      ) : templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
          No templates yet. Create a tournament first, then save it here.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              communityId={community.id}
              canEdit
              onEdit={(tpl) => {
                setEditing(tpl);
                setEditName(tpl.name);
                setEditDescription(tpl.description ?? '');
              }}
              onDelete={(tpl) => {
                if (confirm(`Delete template “${tpl.name}”?`)) remove.mutate(tpl.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
