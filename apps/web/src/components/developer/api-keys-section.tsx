'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Plus } from 'lucide-react';
import { API_KEY_PREFIX, API_KEY_SCOPES, type ApiKeyScope } from '@bracket/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ApiKey } from '@/lib/types-platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretReveal } from './secret-reveal';

const KEYS_QUERY = ['developer', 'api-keys'] as const;

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ApiKeysSection() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['read']);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const list = useQuery({
    queryKey: KEYS_QUERY,
    enabled: !!token,
    queryFn: () => api<ApiKey[]>('/developer/api-keys', { token }),
  });

  const create = useMutation({
    mutationFn: () =>
      api<ApiKey & { secret: string }>('/developer/api-keys', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: name.trim(), scopes }),
      }),
    onSuccess: async (row) => {
      setCreatedSecret(row.secret);
      toast.success('API key created — copy it now, it will not be shown again');
      await qc.invalidateQueries({ queryKey: KEYS_QUERY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/developer/api-keys/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('API key revoked');
      void qc.invalidateQueries({ queryKey: KEYS_QUERY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetDialog() {
    setName('');
    setScopes(['read']);
    setCreatedSecret(null);
    create.reset();
  }

  function toggleScope(scope: ApiKeyScope, on: boolean) {
    setScopes((prev) => {
      if (on) return prev.includes(scope) ? prev : [...prev, scope];
      return prev.filter((s) => s !== scope);
    });
  }

  const columns = useMemo<Column<ApiKey>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            {row.revokedAt && (
              <Badge variant="danger" className="mt-1">
                Revoked
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'prefix',
        header: 'Prefix',
        cell: (row) => (
          <span className="font-mono text-xs text-[var(--color-muted)]">
            {API_KEY_PREFIX}
            {row.keyPrefix}…
          </span>
        ),
      },
      {
        id: 'scopes',
        header: 'Scopes',
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.scopes.map((s) => (
              <Badge key={s} variant={s === 'write' ? 'warning' : 'info'}>
                {s}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'lastUsed',
        header: 'Last used',
        hideBelow: 'md',
        cell: (row) => (
          <span className="text-[var(--color-muted)]">
            {row.lastUsedAt ? formatWhen(row.lastUsedAt) : 'Never'}
          </span>
        ),
      },
      {
        id: 'created',
        header: 'Created',
        hideBelow: 'lg',
        cell: (row) => <span className="text-[var(--color-muted)]">{formatWhen(row.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        align: 'right',
        cell: (row) =>
          row.revokedAt ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[var(--color-danger)]"
              disabled={revoke.isPending}
              onClick={() => {
                if (window.confirm(`Revoke “${row.name}”? Scripts using this key will stop working immediately.`)) {
                  revoke.mutate(row.id);
                }
              }}
            >
              Revoke
            </Button>
          ),
      },
    ],
    [revoke.isPending, revoke.mutate],
  );

  const canSubmit = name.trim().length > 0 && scopes.length > 0 && !create.isPending;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">API keys</h2>
          <p className="mt-1 max-w-xl text-xs text-[var(--color-muted)]">
            Authenticate as you against <code className="font-mono">/v1/*</code>. Send the full key as{' '}
            <code className="font-mono">X-Api-Key</code> or <code className="font-mono">Authorization: Bearer</code>. The
            secret is shown only once.
          </p>
        </div>
        <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Create key
        </Button>
      </div>

      {list.isError && <p className="text-sm text-[var(--color-danger)]">{(list.error as Error).message}</p>}

      <DataTable
        columns={columns}
        rows={list.data ?? []}
        rowKey={(row) => row.id}
        loading={list.isLoading}
        dense
        emptyMessage={
          <span className="inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            No API keys yet. Create one to call the public API.
          </span>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetDialog();
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{createdSecret ? 'Copy your API key' : 'Create API key'}</DialogTitle>
            <DialogDescription>
              {createdSecret
                ? 'Store this key in a secrets manager. We cannot show it again.'
                : 'Name the key and choose scopes. Read is enough for listings; write is required to add participants, report scores, start or finalize.'}
            </DialogDescription>
          </DialogHeader>

          {createdSecret ? (
            <SecretReveal
              title="Full key (shown once)"
              value={createdSecret}
              hint={
                <p>
                  Header example:{' '}
                  <code className="font-mono">X-Api-Key: {createdSecret.slice(0, 16)}…</code>
                </p>
              }
              onDismiss={() => {
                setOpen(false);
                resetDialog();
              }}
            />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                create.mutate();
              }}
            >
              <div>
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="CI bot, scoreboard, …"
                  autoFocus
                  required
                />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-[var(--color-muted)]">Scopes</legend>
                <div className="space-y-2">
                  {API_KEY_SCOPES.map((scope) => {
                    const checked = scopes.includes(scope);
                    return (
                      <label
                        key={scope}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleScope(scope, v === true)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm font-medium capitalize">{scope}</span>
                          <span className="text-xs text-[var(--color-muted)]">
                            {scope === 'read'
                              ? 'List tournaments, participants and matches you can access.'
                              : 'Add participants, report results, start and finalize tournaments you manage.'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={create.isPending} disabled={!canSubmit}>
                  Create key
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
