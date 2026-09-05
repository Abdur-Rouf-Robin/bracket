'use client';

import Link from 'next/link';
import { BookOpen, ExternalLink, KeyRound } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ApiKeysSection } from './api-keys-section';
import { WebhooksSection } from './webhooks-section';

const SWAGGER_URL = `${API_URL}/api/docs`;

export function DeveloperSettings() {
  return (
    <div className="space-y-8">
      <section className="gaming-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Public API</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Call Bracket from scoreboards, bots and your own tools. Keys act as you: they can see public
          tournaments and manage ones you own or administer.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/api-docs">
              <BookOpen />
              API docs
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={SWAGGER_URL} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open Swagger
            </a>
          </Button>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <KeyRound className="h-3.5 w-3.5" />
          Base URL <code className="font-mono">{API_URL}/v1</code>
        </p>
      </section>

      <ApiKeysSection />
      <WebhooksSection />
    </div>
  );
}
