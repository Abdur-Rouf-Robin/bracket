'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Tab = 'overview' | 'users' | 'tournaments' | 'games' | 'plans';

type AdminStats = {
  users: number;
  admins: number;
  tournaments: number;
  activeTournaments: number;
  games: number;
  matches: number;
  teams: number;
};

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  _count: { tournaments: number };
};

type AdminTournament = {
  id: string;
  name: string;
  slug: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  isPublic: boolean;
  format: string | null;
  createdAt: string;
  game: { id: string; name: string } | null;
  createdBy: { id: string; name: string; email: string };
  _count: { teams: number; matches: number };
};

type AdminGame = {
  id: string;
  name: string;
  category: string;
  sortOrder: number;
  active: boolean;
  _count: { tournaments: number };
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'tournaments', label: 'Tournaments' },
  { id: 'games', label: 'Games' },
  { id: 'plans', label: 'Plans' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function AdminPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [userQuery, setUserQuery] = useState('');
  const [tournamentQuery, setTournamentQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/admin');
  }, [loading, user, router]);

  const isAdmin = user?.role === 'ADMIN';
  const auth = useMemo(() => ({ token }), [token]);

  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    enabled: !!token && isAdmin,
    queryFn: () => api<AdminStats>('/admin/stats', auth),
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users', userQuery],
    enabled: !!token && isAdmin && (tab === 'users' || tab === 'plans'),
    queryFn: () =>
      api<AdminUser[]>(
        `/admin/users${userQuery.trim() ? `?q=${encodeURIComponent(userQuery.trim())}` : ''}`,
        auth,
      ),
  });

  const tournamentsQuery = useQuery({
    queryKey: ['admin-tournaments', tournamentQuery],
    enabled: !!token && isAdmin && (tab === 'tournaments' || tab === 'overview'),
    queryFn: () =>
      api<AdminTournament[]>(
        `/admin/tournaments${
          tournamentQuery.trim()
            ? `?q=${encodeURIComponent(tournamentQuery.trim())}`
            : ''
        }`,
        auth,
      ),
  });

  const gamesQuery = useQuery({
    queryKey: ['admin-games'],
    enabled: !!token && isAdmin && (tab === 'games' || tab === 'overview'),
    queryFn: () => api<AdminGame[]>('/admin/games', auth),
  });

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['admin-stats'] });
    void qc.invalidateQueries({ queryKey: ['admin-users'] });
    void qc.invalidateQueries({ queryKey: ['admin-tournaments'] });
    void qc.invalidateQueries({ queryKey: ['admin-games'] });
  };

  const createUser = useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      password: string;
      role: 'USER' | 'ADMIN';
    }) => api('/admin/users', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const updateUser = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      role?: 'USER' | 'ADMIN';
      password?: string;
    }) =>
      api(`/admin/users/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/users/${id}`, { method: 'DELETE', token }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const updateTournament = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      status?: AdminTournament['status'];
      isPublic?: boolean;
    }) =>
      api(`/admin/tournaments/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const deleteTournament = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/tournaments/${id}`, { method: 'DELETE', token }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const createGame = useMutation({
    mutationFn: (body: {
      name: string;
      category: string;
      sortOrder: number;
    }) => api('/admin/games', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const updateGame = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      category?: string;
      sortOrder?: number;
      active?: boolean;
    }) =>
      api(`/admin/games/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const deleteGame = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/games/${id}`, { method: 'DELETE', token }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const grantPlan = useMutation({
    mutationFn: (body: {
      userId: string;
      plan: 'FREE' | 'PREMIER';
      expiresAt?: string | null;
    }) =>
      api('/billing/admin/grant', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-8 text-[var(--color-muted)]">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <h1 className="font-display text-3xl font-bold">Admin only</h1>
          <p className="mt-3 text-[var(--color-muted)]">
            This CMS is limited to platform administrators.
          </p>
          <Link href="/" className="mt-6 inline-block text-[var(--color-accent)]">
            Back home
          </Link>
        </main>
      </div>
    );
  }

  const stats = statsQuery.data;
  const users = usersQuery.data ?? [];
  const tournaments = tournamentsQuery.data ?? [];
  const games = gamesQuery.data ?? [];

  function onCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    createUser.mutate({
      name: String(fd.get('name') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      password: String(fd.get('password') ?? ''),
      role: fd.get('role') === 'ADMIN' ? 'ADMIN' : 'USER',
    });
    e.currentTarget.reset();
  }

  function onCreateGame(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    createGame.mutate({
      name: String(fd.get('name') ?? '').trim(),
      category: String(fd.get('category') ?? '').trim(),
      sortOrder: Number(fd.get('sortOrder') || 100),
    });
    e.currentTarget.reset();
  }

  function onGrantPlan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const expiresRaw = String(fd.get('expiresAt') ?? '').trim();
    grantPlan.mutate({
      userId: String(fd.get('userId') ?? '').trim(),
      plan: fd.get('plan') === 'PREMIER' ? 'PREMIER' : 'FREE',
      expiresAt: expiresRaw ? new Date(expiresRaw).toISOString() : null,
    });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--color-muted)]">
              CMS
            </p>
            <h1 className="font-display text-3xl font-bold">Admin panel</h1>
            <p className="mt-1 text-[var(--color-muted)]">
              Manage users, tournaments, and games across the platform.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="secondary">Your tournaments</Button>
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setError('');
                setTab(item.id);
              }}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                tab === item.id
                  ? 'bg-[var(--color-accent)] text-[#041018]'
                  : 'border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>
        )}

        {tab === 'overview' && (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Users', stats?.users],
                ['Admins', stats?.admins],
                ['Tournaments', stats?.tournaments],
                ['Active events', stats?.activeTournaments],
                ['Games', stats?.games],
                ['Teams', stats?.teams],
                ['Matches', stats?.matches],
              ].map(([label, value]) => (
                <article key={String(label)} className="gaming-card rounded-xl p-5">
                  <p className="text-sm text-[var(--color-muted)]">{label}</p>
                  <p className="font-display mt-2 text-3xl font-bold">
                    {value ?? '—'}
                  </p>
                </article>
              ))}
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              Use the tabs above to create accounts, change roles, publish or
              hide tournaments, and maintain the game catalog.
            </p>
          </section>
        )}

        {tab === 'users' && (
          <section className="space-y-6">
            <form
              onSubmit={onCreateUser}
              className="gaming-card grid gap-3 rounded-xl p-5 md:grid-cols-5"
            >
              <div className="md:col-span-5">
                <h2 className="font-display text-lg font-bold">Create user</h2>
              </div>
              <div>
                <Label htmlFor="user-name">Name</Label>
                <Input id="user-name" name="name" required />
              </div>
              <div>
                <Label htmlFor="user-email">Email</Label>
                <Input id="user-email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="user-password">Password</Label>
                <Input
                  id="user-password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <Label htmlFor="user-role">Role</Label>
                <select id="user-role" name="role" className="field-select">
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createUser.isPending} className="w-full">
                  {createUser.isPending ? 'Creating…' : 'Add user'}
                </Button>
              </div>
            </form>

            <Input
              placeholder="Search users by name or email"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />

            <div className="space-y-3">
              {usersQuery.isLoading && (
                <p className="text-[var(--color-muted)]">Loading users…</p>
              )}
              {users.map((row) => (
                <div
                  key={row.id}
                  className="gaming-card flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {row.name}{' '}
                      <span className="text-xs uppercase text-[var(--color-muted)]">
                        {row.role}
                      </span>
                    </p>
                    <p className="text-sm text-[var(--color-muted)]">
                      {row.email} · {row._count.tournaments} tournaments ·{' '}
                      {formatDate(row.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() =>
                        updateUser.mutate({
                          id: row.id,
                          role: row.role === 'ADMIN' ? 'USER' : 'ADMIN',
                        })
                      }
                    >
                      {row.role === 'ADMIN' ? 'Make user' : 'Make admin'}
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        const password = window.prompt(
                          `New password for ${row.email} (min 8 characters)`,
                        );
                        if (password && password.length >= 8) {
                          updateUser.mutate({ id: row.id, password });
                        }
                      }}
                    >
                      Reset password
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete ${row.email}?`)) {
                          deleteUser.mutate(row.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'tournaments' && (
          <section className="space-y-6">
            <Input
              placeholder="Search tournaments by name or slug"
              value={tournamentQuery}
              onChange={(e) => setTournamentQuery(e.target.value)}
            />
            <div className="space-y-3">
              {tournamentsQuery.isLoading && (
                <p className="text-[var(--color-muted)]">Loading tournaments…</p>
              )}
              {!tournamentsQuery.isLoading && tournaments.length === 0 && (
                <p className="text-[var(--color-muted)]">No tournaments found.</p>
              )}
              {tournaments.map((row) => (
                <div
                  key={row.id}
                  className="gaming-card flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-[var(--color-muted)]">
                      /t/{row.slug} · {row.status}
                      {row.format ? ` · ${row.format.replaceAll('_', ' ')}` : ''}
                      {row.game ? ` · ${row.game.name}` : ''} ·{' '}
                      {row.isPublic ? 'Public' : 'Private'} ·{' '}
                      {row._count.teams} teams · {row.createdBy.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="field-select w-auto"
                      value={row.status}
                      onChange={(e) =>
                        updateTournament.mutate({
                          id: row.id,
                          status: e.target.value as AdminTournament['status'],
                        })
                      }
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() =>
                        updateTournament.mutate({
                          id: row.id,
                          isPublic: !row.isPublic,
                        })
                      }
                    >
                      {row.isPublic ? 'Make private' : 'Make public'}
                    </Button>
                    <Link href={`/t/${row.slug}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                    <Link href={`/t/${row.slug}/manage`}>
                      <Button>Manage</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete “${row.name}”?`)) {
                          deleteTournament.mutate(row.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'games' && (
          <section className="space-y-6">
            <form
              onSubmit={onCreateGame}
              className="gaming-card grid gap-3 rounded-xl p-5 md:grid-cols-4"
            >
              <div className="md:col-span-4">
                <h2 className="font-display text-lg font-bold">Add game</h2>
              </div>
              <div>
                <Label htmlFor="game-name">Name</Label>
                <Input id="game-name" name="name" required />
              </div>
              <div>
                <Label htmlFor="game-category">Category</Label>
                <Input
                  id="game-category"
                  name="category"
                  placeholder="Esports or Outdoor"
                  required
                />
              </div>
              <div>
                <Label htmlFor="game-order">Sort order</Label>
                <Input
                  id="game-order"
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={100}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createGame.isPending} className="w-full">
                  {createGame.isPending ? 'Adding…' : 'Add game'}
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {gamesQuery.isLoading && (
                <p className="text-[var(--color-muted)]">Loading games…</p>
              )}
              {games.map((row) => (
                <div
                  key={row.id}
                  className="gaming-card flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {row.name}{' '}
                      <span className="text-xs text-[var(--color-muted)]">
                        {row.active ? 'Active' : 'Hidden'}
                      </span>
                    </p>
                    <p className="text-sm text-[var(--color-muted)]">
                      {row.category} · sort {row.sortOrder} ·{' '}
                      {row._count.tournaments} tournaments
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() =>
                        updateGame.mutate({ id: row.id, active: !row.active })
                      }
                    >
                      {row.active ? 'Hide' : 'Show'}
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete “${row.name}”?`)) {
                          deleteGame.mutate(row.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'plans' && (
          <section className="space-y-6">
            <form
              onSubmit={onGrantPlan}
              className="gaming-card grid gap-3 rounded-xl p-5 md:grid-cols-4"
            >
              <div className="md:col-span-4">
                <h2 className="font-display text-lg font-bold">Grant plan</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Manually assign Standard or Premier. An optional expiry applies
                  to Premier grants.
                </p>
              </div>
              <div>
                <Label htmlFor="grant-user">User id</Label>
                <Input id="grant-user" name="userId" required placeholder="cuid…" />
              </div>
              <div>
                <Label htmlFor="grant-plan">Plan</Label>
                <select id="grant-plan" name="plan" className="field-select">
                  <option value="PREMIER">Premier</option>
                  <option value="FREE">Standard</option>
                </select>
              </div>
              <div>
                <Label htmlFor="grant-expires">Expires (optional)</Label>
                <Input id="grant-expires" name="expiresAt" type="datetime-local" />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={grantPlan.isPending} className="w-full">
                  {grantPlan.isPending ? 'Saving…' : 'Grant plan'}
                </Button>
              </div>
            </form>

            <Input
              placeholder="Search users by name or email"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />

            <div className="space-y-3">
              {usersQuery.isLoading && (
                <p className="text-[var(--color-muted)]">Loading users…</p>
              )}
              {users.map((row) => (
                <div
                  key={row.id}
                  className="gaming-card flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-[var(--color-muted)]">
                      {row.email} · {row.id}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={grantPlan.isPending}
                      onClick={() =>
                        grantPlan.mutate({ userId: row.id, plan: 'PREMIER' })
                      }
                    >
                      Grant Premier
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={grantPlan.isPending}
                      onClick={() =>
                        grantPlan.mutate({ userId: row.id, plan: 'FREE' })
                      }
                    >
                      Set Standard
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
