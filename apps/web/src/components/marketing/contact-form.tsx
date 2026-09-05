'use client';

import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@bracket.app';

const TOPICS = [
  { value: 'support', label: 'Help with a tournament' },
  { value: 'premier', label: 'Premier & billing' },
  { value: 'help', label: 'Help article feedback' },
  { value: 'bug', label: 'Report a bug' },
  { value: 'partnership', label: 'Partnership / press' },
  { value: 'other', label: 'Something else' },
];

export function ContactForm() {
  const params = useSearchParams();
  const { user } = useAuth();
  const [topic, setTopic] = useState(params.get('topic') ?? 'support');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [link, setLink] = useState('');
  const [message, setMessage] = useState(
    params.get('article') ? `Feedback on help article "${params.get('article')}":\n\n` : '',
  );
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const subject = `[${TOPICS.find((t) => t.value === topic)?.label ?? 'Contact'}] from ${name || 'a Bracket user'}`;
    const body = `${message}\n\n—\nName: ${name}\nEmail: ${email}\nLink: ${link}`;
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setSent(true);
    toast.success('Opening your email app — send the message to finish.');
  }

  if (sent) {
    return (
      <div className="card p-8 text-center">
        <Mail className="mx-auto size-8 text-[var(--color-accent)]" aria-hidden />
        <h2 className="font-display mt-3 text-xl font-bold">Almost there</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Your email app should have opened with the message prepared. If it did not, email us directly at{' '}
          <a className="text-[var(--color-accent)] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => setSent(false)}>Write another</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <Label htmlFor="c-topic">Topic</Label>
        <Select value={topic} onChange={(v) => setTopic(v || 'support')} options={TOPICS} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-name">Your name</Label>
          <Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
      </div>
      <div>
        <Label htmlFor="c-link">Tournament or page link (optional)</Label>
        <Input id="c-link" type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="c-message">Message</Label>
        <Textarea id="c-message" required minLength={10} value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-40" placeholder="What happened, what did you expect, and when?" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--color-muted)]">We usually reply within one business day. Premier gets priority.</p>
        <Button type="submit"><Send /> Send message</Button>
      </div>
    </form>
  );
}
