'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function NewCircuitPage() {
  const { token, user, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api<{ slug: string }>('/circuits', {
        method: 'POST',
        token,
        body: JSON.stringify({ name, description: description.trim() || null }),
      }),
    onSuccess: (circuit) => router.push(`/circuits/${circuit.slug}`),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container-page flex-1 py-12">
        <h1 className="font-display text-3xl font-bold">New circuit</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
          A circuit is the season table. Create it, then attach tournaments you own.
        </p>
        {!loading && !user && (
          <p className="mt-6 text-sm">
            <a className="text-[var(--color-accent)]" href="/login?next=/circuits/new">Sign in</a> to create a circuit.
          </p>
        )}
        {user && (
          <form
            className="mt-8 max-w-lg space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div>
              <Label htmlFor="circuit-name">Name</Label>
              <Input id="circuit-name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="circuit-description">Description</Label>
              <Input id="circuit-description" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
            <Button type="submit" disabled={name.trim().length < 2 || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create circuit'}
            </Button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
