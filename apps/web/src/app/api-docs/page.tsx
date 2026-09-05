import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ExternalLink, KeyRound, ShieldCheck, Webhook } from 'lucide-react';
import {
  API_KEY_PREFIX,
  PUBLIC_API_RATE_LIMIT_PER_MINUTE,
  WEBHOOK_AUTO_DISABLE_FAILURES,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENTS,
} from '@bracket/shared';
import { API_URL } from '@/lib/api';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'API docs',
  description:
    'Public REST API v1: authenticate with an API key, list tournaments, report scores and receive signed webhooks.',
};

const SWAGGER = `${API_URL}/api/docs`;

const TOC = [
  { href: '#auth', label: 'Authentication' },
  { href: '#endpoints', label: 'Endpoints' },
  { href: '#errors', label: 'Errors' },
  { href: '#webhooks', label: 'Webhooks' },
  { href: '#limits', label: 'Rate limits' },
] as const;

type HttpMethod = 'GET' | 'POST' | 'PUT';

type EndpointDoc = {
  method: HttpMethod;
  path: string;
  scope: 'read' | 'write';
  summary: string;
  notes?: string;
  query?: string;
  body?: string;
  curl: string;
};

function endpoints(base: string): EndpointDoc[] {
  return [
    {
      method: 'GET',
      path: '/v1/me',
      scope: 'read',
      summary: 'Confirm the key works. Returns the owner’s user id and the key’s scopes.',
      curl: `curl ${base}/v1/me \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…"`,
    },
    {
      method: 'GET',
      path: '/v1/tournaments',
      scope: 'read',
      summary: 'Tournaments you created or administer (not the public discovery catalog).',
      curl: `curl ${base}/v1/tournaments \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…"`,
    },
    {
      method: 'GET',
      path: '/v1/tournaments/:idOrSlug',
      scope: 'read',
      summary: 'One tournament by cuid or slug. Private events 404 unless the key owner can manage them.',
      query: 'include=participants,matches,standings — comma-separated extras.',
      curl: `curl "${base}/v1/tournaments/summer-open?include=participants,matches" \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…"`,
    },
    {
      method: 'GET',
      path: '/v1/tournaments/:idOrSlug/participants',
      scope: 'read',
      summary: 'Teams / players in seed order, including roster rows.',
      curl: `curl ${base}/v1/tournaments/summer-open/participants \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…"`,
    },
    {
      method: 'POST',
      path: '/v1/tournaments/:idOrSlug/participants',
      scope: 'write',
      summary: 'Add a participant before the bracket is generated.',
      body: '{ "name": "Team Alpha", "seed": 1, "players": ["Ada"] }',
      notes: 'Fails after generate (bracket_generated), on duplicate names, or when the event is full.',
      curl: `curl ${base}/v1/tournaments/summer-open/participants \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Team Alpha","seed":1}'`,
    },
    {
      method: 'GET',
      path: '/v1/tournaments/:idOrSlug/matches',
      scope: 'read',
      summary: 'Non-bye matches. Filter with state=open (ready to play), complete, or all (default).',
      query: 'state=open | complete | all',
      curl: `curl "${base}/v1/tournaments/summer-open/matches?state=open" \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…"`,
    },
    {
      method: 'PUT',
      path: '/v1/matches/:id',
      scope: 'write',
      summary: 'Report a result. You must manage the parent tournament.',
      body: '{ "homeScore": 2, "awayScore": 1, "winnerId": "optional_team_id", "sets": [{"home":11,"away":7}] }',
      notes:
        'If sets[] is sent, scores become set-wins. winnerId must be home or away. Omit it to infer from scores (equal scores are a draw).',
      curl: `curl ${base}/v1/matches/MATCH_ID -X PUT \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"homeScore":2,"awayScore":1}'`,
    },
    {
      method: 'POST',
      path: '/v1/tournaments/:idOrSlug/start',
      scope: 'write',
      summary: 'Generate the bracket from saved settings. Owner only — admins get owner_only.',
      curl: `curl ${base}/v1/tournaments/summer-open/start -X POST \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…"`,
    },
    {
      method: 'POST',
      path: '/v1/tournaments/:idOrSlug/finalize',
      scope: 'write',
      summary: 'Mark the tournament completed and fire tournament.completed. Idempotent if already done.',
      curl: `curl ${base}/v1/tournaments/summer-open/finalize -X POST \\\n  -H "X-Api-Key: ${API_KEY_PREFIX}…"`,
    },
  ];
}

const SIGNATURE_SNIPPET = `const crypto = require('crypto');

function verifySignature(rawBody, secret, header) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(header ?? '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express: app.use(express.raw({ type: 'application/json' }))
// then verifySignature(req.body, secret, req.get('X-Bracket-Signature'))`;

const PAYLOAD_EXAMPLE = `{
  "id": "8f3c1e2a-…",
  "event": "match.completed",
  "createdAt": "2026-09-05T12:00:00.000Z",
  "tournamentId": "clxxxxxxxxxxxxxxxxxxxxxxxx",
  "data": {
    "tournament": { "id": "…", "slug": "summer-open", "name": "Summer Open", "status": "ACTIVE", "format": "SINGLE_ELIM" },
    "match": { "id": "…", "round": 2, "status": "COMPLETED", "homeScore": 2, "awayScore": 1 }
  }
}`;

export default function ApiDocsPage() {
  const docs = endpoints(API_URL);

  return (
    <MarketingShell>
      <section className="container-page pt-16 pb-10">
        <SectionHeading
          eyebrow="Developers"
          title="Public API v1"
          description="Authenticate with an API key, read and update tournaments you manage, and receive signed webhooks when the bracket moves."
        />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/settings/developer">
              <KeyRound />
              Manage API keys
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <a href={SWAGGER} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open Swagger
            </a>
          </Button>
        </div>
      </section>

      <section className="container-page grid gap-10 pb-20 lg:grid-cols-[14rem_1fr]">
        <nav
          aria-label="On this page"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            On this page
          </p>
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {TOC.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="block rounded-md px-2 py-1 text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 space-y-14">
          <section id="auth" className="scroll-mt-28">
            <h2 className="font-display text-2xl font-bold">Authentication</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Create a key in Settings → Developer. The full token is shown once and starts with{' '}
              <code className="font-mono text-[var(--color-ink)]">{API_KEY_PREFIX}</code>. Send it on every{' '}
              <code className="font-mono text-[var(--color-ink)]">/v1</code> request — either header works:
            </p>
            <Code>{`X-Api-Key: ${API_KEY_PREFIX}…\nAuthorization: Bearer ${API_KEY_PREFIX}…`}</Code>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
              <li>
                <strong className="text-[var(--color-ink)]">read</strong> — list and fetch tournaments, participants and
                matches.
              </li>
              <li>
                <strong className="text-[var(--color-ink)]">write</strong> — add participants, report scores, start or
                finalize. GET routes still work on a write-only key.
              </li>
              <li>The key acts as its owner. Public tournaments are readable; private ones only if you can manage them.</li>
            </ul>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Interactive try-it-out lives on{' '}
              <a href={SWAGGER} className="text-[var(--color-accent)] underline-offset-2 hover:underline">
                Swagger
              </a>
              .
            </p>
          </section>

          <section id="endpoints" className="scroll-mt-28 space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold">Endpoints</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Base URL <code className="font-mono text-[var(--color-ink)]">{API_URL}</code>. JSON in and out.{' '}
                <code className="font-mono text-[var(--color-ink)]">:idOrSlug</code> accepts a tournament cuid or its
                public slug.
              </p>
            </div>
            {docs.map((ep) => (
              <EndpointCard key={`${ep.method} ${ep.path}`} ep={ep} />
            ))}
          </section>

          <section id="errors" className="scroll-mt-28">
            <h2 className="font-display text-2xl font-bold">Errors</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Failed <code className="font-mono text-[var(--color-ink)]">/v1</code> responses use a single envelope.
              Validation failures may add <code className="font-mono text-[var(--color-ink)]">details</code>.
            </p>
            <Code>{`{\n  "error": {\n    "code": "not_found",\n    "message": "Tournament not found"\n  }\n}`}</Code>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-line)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Code</th>
                    <th className="px-3 py-2 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)] text-[var(--color-muted)]">
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">unauthorized</td>
                    <td className="px-3 py-2">Missing API key</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">invalid_api_key</td>
                    <td className="px-3 py-2">Unknown or revoked key</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">insufficient_scope</td>
                    <td className="px-3 py-2">Write endpoint called with a read-only key</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">forbidden / owner_only</td>
                    <td className="px-3 py-2">You do not manage this tournament (start is owner-only)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">not_found</td>
                    <td className="px-3 py-2">Unknown id — or a private event you cannot see</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">rate_limited</td>
                    <td className="px-3 py-2">{PUBLIC_API_RATE_LIMIT_PER_MINUTE} requests per minute per key</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">validation_error</td>
                    <td className="px-3 py-2">Body failed schema checks</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="webhooks" className="scroll-mt-28 space-y-4">
            <div className="flex items-start gap-3">
              <Webhook className="mt-1 size-6 shrink-0 text-[var(--color-accent)]" aria-hidden />
              <div>
                <h2 className="font-display text-2xl font-bold">Webhooks</h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Register an HTTPS URL in Developer settings (or a tournament’s Integrations tab). We POST JSON within
                  5 seconds and sign the <em>raw</em> body. After {WEBHOOK_AUTO_DISABLE_FAILURES} consecutive failures
                  the hook is paused. Test deliveries add <code className="font-mono text-[var(--color-ink)]">X-Bracket-Test: 1</code>.
                </p>
              </div>
            </div>

            <h3 className="font-display text-lg font-semibold">Headers</h3>
            <ul className="space-y-1.5 text-sm text-[var(--color-muted)]">
              <li>
                <code className="font-mono text-[var(--color-ink)]">X-Bracket-Event</code> — event name, e.g.{' '}
                <code className="font-mono">match.completed</code>
              </li>
              <li>
                <code className="font-mono text-[var(--color-ink)]">X-Bracket-Signature</code> —{' '}
                <code className="font-mono">sha256=</code> plus hex HMAC-SHA256 of the raw body
              </li>
              <li>
                <code className="font-mono text-[var(--color-ink)]">X-Bracket-Delivery</code> — unique delivery id
              </li>
              <li>
                <code className="font-mono text-[var(--color-ink)]">User-Agent</code> —{' '}
                <code className="font-mono">Bracket-Webhooks/1.0</code>
              </li>
            </ul>

            <h3 className="font-display text-lg font-semibold">Events</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <li key={ev} className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm">
                  <code className="font-mono text-xs text-[var(--color-ink)]">{ev}</code>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">{WEBHOOK_EVENT_LABELS[ev]}</p>
                </li>
              ))}
            </ul>

            <h3 className="font-display text-lg font-semibold">Payload</h3>
            <p className="text-sm text-[var(--color-muted)]">
              Every delivery is <code className="font-mono text-[var(--color-ink)]">{'{ id, event, createdAt, tournamentId, data }'}</code>.
              When we know the tournament we attach a short summary on <code className="font-mono">data.tournament</code>;
              match events also include <code className="font-mono">data.match</code>. A test ping sends{' '}
              <code className="font-mono">{'{ test: true, message: "Test delivery from Bracket" }'}</code> as{' '}
              <code className="font-mono">data</code>.
            </p>
            <Code>{PAYLOAD_EXAMPLE}</Code>

            <h3 className="font-display text-lg font-semibold">Verify the signature (Node)</h3>
            <p className="text-sm text-[var(--color-muted)]">
              Hash the exact bytes you received. Re-serializing JSON will fail the check.
            </p>
            <Code>{SIGNATURE_SNIPPET}</Code>
          </section>

          <section id="limits" className="scroll-mt-28">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 size-6 shrink-0 text-[var(--color-accent)]" aria-hidden />
              <div>
                <h2 className="font-display text-2xl font-bold">Rate limits</h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {PUBLIC_API_RATE_LIMIT_PER_MINUTE} requests per minute per API key. Responses include{' '}
                  <code className="font-mono text-[var(--color-ink)]">X-RateLimit-Limit</code> and{' '}
                  <code className="font-mono text-[var(--color-ink)]">X-RateLimit-Remaining</code>. Over the limit you
                  get <code className="font-mono">429</code> with <code className="font-mono">Retry-After</code>.
                </p>
              </div>
            </div>
            <div className="card mt-6 flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 size-5 text-[var(--color-accent)]" aria-hidden />
                <div>
                  <p className="font-display font-semibold">Ready to call it?</p>
                  <p className="text-sm text-[var(--color-muted)]">Mint a key, then try the live schema explorer.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/settings/developer">Create a key</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <a href={SWAGGER} target="_blank" rel="noreferrer">
                    Swagger
                  </a>
                </Button>
              </div>
            </div>
          </section>
        </article>
      </section>
    </MarketingShell>
  );
}

function MethodBadge({ method }: { method: HttpMethod }) {
  const tone =
    method === 'GET'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : method === 'POST'
        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${tone}`}>{method}</span>
  );
}

function EndpointCard({ ep }: { ep: EndpointDoc }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)]/50 px-4 py-3">
        <MethodBadge method={ep.method} />
        <code className="min-w-0 break-all font-mono text-sm font-semibold">{ep.path}</code>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            ep.scope === 'write'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              : 'bg-[var(--color-line)] text-[var(--color-muted)]'
          }`}
        >
          {ep.scope}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm text-[var(--color-muted)]">{ep.summary}</p>
        {ep.query && (
          <p className="text-xs text-[var(--color-muted)]">
            Query <code className="font-mono text-[var(--color-ink)]">{ep.query}</code>
          </p>
        )}
        {ep.body && (
          <p className="text-xs text-[var(--color-muted)]">
            Body <code className="font-mono text-[var(--color-ink)]">{ep.body}</code>
          </p>
        )}
        {ep.notes && <p className="text-xs text-[var(--color-muted)]">{ep.notes}</p>}
        <Code>{ep.curl}</Code>
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[#0a0c10] p-4 font-mono text-[12px] leading-relaxed text-white/90">
      <code>{children}</code>
    </pre>
  );
}
