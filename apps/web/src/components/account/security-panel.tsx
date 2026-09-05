'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SecurityPanel() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const changePassword = useMutation({
    mutationFn: () =>
      api('/account/password', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      }),
    onSuccess: () => {
      toast.success('Password updated');
      setCurrent('');
      setNext('');
      setConfirm('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAccount = useMutation({
    mutationFn: () =>
      api('/account', {
        method: 'DELETE',
        token,
        body: JSON.stringify({ password: deletePassword }),
      }),
    onSuccess: () => {
      toast.success('Your account has been deleted');
      logout();
      router.replace('/');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <form
        className="gaming-card space-y-4 rounded-2xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (next.length < 8) {
            toast.error('New password must be at least 8 characters');
            return;
          }
          if (next !== confirm) {
            toast.error('Passwords do not match');
            return;
          }
          changePassword.mutate();
        }}
      >
        <h2 className="font-display text-lg font-semibold">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="next">New password</Label>
            <Input
              id="next"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={changePassword.isPending || !current || !next}>
            {changePassword.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>

      <section className="rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-[var(--color-danger)]" />
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Delete account</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              This permanently removes your account, registrations, comments and notifications.
              You must delete or transfer any tournaments, communities or events you own first.
            </p>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (deleteConfirmText !== 'DELETE') {
                  toast.error('Type DELETE to confirm');
                  return;
                }
                if (window.confirm('Delete your account permanently? This cannot be undone.')) {
                  deleteAccount.mutate();
                }
              }}
            >
              <div>
                <Label htmlFor="delete-password">Your password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  required
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  className="border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                  disabled={deleteAccount.isPending || !deletePassword || deleteConfirmText !== 'DELETE'}
                >
                  {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
