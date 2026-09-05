'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Link2, MapPin, Paperclip, Share2, Upload, X } from 'lucide-react';
import { resolveRoundLabel, type TournamentSettings } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { MatchResultView, matchToResultData } from '@/components/match-result-view';
import { MatchVoteBar } from '@/components/match-vote-bar';
import { MatchInlineResultForm } from '@/components/match-inline-result-form';
import { MatchComments } from '@/components/match-comments';
import { uploadImage } from '@/components/image-url-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTournamentLive } from '@/lib/use-tournament-live';
import type { Match, Tournament } from '@/lib/types';

const BRACKET_SIDE_LABELS: Record<string, string> = {
  WINNERS: 'Winners bracket',
  LOSERS: 'Losers bracket',
  GRAND_FINAL: 'Grand final',
  GROUP: 'Group stage',
  SWISS: 'Swiss',
  PLACEMENT: 'Placement',
  MAIN: 'Main bracket',
};

function stageLabel(m: Match, tournament: Tournament) {
  if (m.bracketSide === 'GROUP') {
    const group = tournament.groups.find((g) => g.id === m.groupId);
    return group ? `Group ${group.name}` : 'Group stage';
  }
  return BRACKET_SIDE_LABELS[m.bracketSide] ?? m.bracketSide.replaceAll('_', ' ');
}

function formatWhen(iso: string | null | undefined, timezone?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || undefined,
    });
  } catch {
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'COMPLETED':
      return { text: 'Final', tone: 'text-[var(--color-muted)] border-[var(--color-line)]' };
    case 'IN_PROGRESS':
    case 'LIVE':
      return { text: 'Live', tone: 'text-[var(--color-ok)] border-[var(--color-ok)]/40' };
    case 'CANCELLED':
      return { text: 'Cancelled', tone: 'text-red-400 border-red-400/40' };
    default:
      return { text: 'Upcoming', tone: 'text-[var(--color-accent)] border-[var(--color-accent)]/40' };
  }
}

export default function MatchDetailPage() {
  const params = useParams<{ slug: string; matchId: string }>();
  const { slug, matchId } = params;
  const { user, token } = useAuth();

  const { data: tournament, isLoading, error } = useQuery({
    queryKey: ['tournament', slug, token ?? 'anon'],
    queryFn: () => api<Tournament>(`/t/${slug}`, { token: token ?? undefined }),
  });
  useTournamentLive(tournament?.id, slug);

  const match = tournament?.matches.find((m) => m.id === matchId);
  const settings = (tournament?.settings ?? {}) as TournamentSettings;

  const viewerTeamId =
    user && match
      ? [match.homeTeam, match.awayTeam].find((t) => t?.registeredByUserId === user.id)?.id ?? null
      : null;
  const isParticipant = !!viewerTeamId;
  const canManage = !!tournament?.canManage;
  const canSelfReport =
    !!token &&
    !!match &&
    settings.allowParticipantsReportScores === true &&
    isParticipant &&
    !canManage &&
    match.status !== 'COMPLETED' &&
    !!match.homeTeamId &&
    !!match.awayTeamId;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/t/${slug}`} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            ← {tournament?.name ?? 'Tournament'}
          </Link>
          <Link href={`/t/${slug}?tab=matches`} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            All matches
          </Link>
          {canManage && (
            <Link href={`/t/${slug}/manage?tab=matches`} className="text-[var(--color-accent)] hover:underline">
              Manage matches
            </Link>
          )}
        </nav>

        {isLoading && <p className="text-[var(--color-muted)]">Loading match…</p>}
        {error && (
          <p className="text-red-500">{error instanceof Error ? error.message : 'Could not load tournament'}</p>
        )}
        {tournament && !match && (
          <div className="gaming-card rounded-2xl p-8 text-center">
            <h1 className="font-display text-2xl font-bold">Match not found</h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              This match doesn&apos;t exist in {tournament.name}, or the bracket was regenerated.
            </p>
            <Link href={`/t/${slug}?tab=matches`} className="mt-4 inline-block">
              <Button variant="secondary">Back to matches</Button>
            </Link>
          </div>
        )}

        {tournament && match && (
          <MatchDetail
            match={match}
            tournament={tournament}
            slug={slug}
            token={token ?? undefined}
            canManage={canManage}
            isParticipant={isParticipant}
            canSelfReport={canSelfReport}
            settings={settings}
          />
        )}
      </main>
    </div>
  );
}

function MatchDetail({
  match,
  tournament,
  slug,
  token,
  canManage,
  isParticipant,
  canSelfReport,
  settings,
}: {
  match: Match;
  tournament: Tournament;
  slug: string;
  token?: string;
  canManage: boolean;
  isParticipant: boolean;
  canSelfReport: boolean;
  settings: TournamentSettings;
}) {
  const koMatches = tournament.matches.filter((x) => x.bracketSide !== 'GROUP' && x.bracketSide !== 'SWISS');
  const totalRounds = koMatches.length ? Math.max(...koMatches.map((x) => x.round)) : undefined;
  const roundLabel =
    match.bracketSide === 'GROUP' || match.bracketSide === 'SWISS'
      ? `Round ${match.round}`
      : resolveRoundLabel(match.round, settings, totalRounds);
  const when = formatWhen(match.scheduledAt, tournament.timezone);
  const status = statusLabel(match.status);
  const station = match.stationRef?.name ?? match.station ?? null;
  const resultData = matchToResultData(match, tournament);
  const hasResult = match.status === 'COMPLETED' || match.homeScore != null || match.awayScore != null;

  const share = async () => {
    const url = window.location.href;
    const title = `${match.homeTeam?.name ?? 'TBD'} vs ${match.awayTeam?.name ?? 'TBD'} · ${tournament.name}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <div className="space-y-8">
      <header className="gaming-card rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">
              {tournament.name}
            </p>
            <h1 className="font-display mt-1 text-2xl font-bold">
              {roundLabel}
              <span className="ml-2 text-base font-normal text-[var(--color-muted)]">
                · {stageLabel(match, tournament)}
              </span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.tone}`}>
                {status.text}
              </span>
              {when && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" /> {when}
                  {match.durationMinutes ? ` · ${match.durationMinutes} min` : ''}
                </span>
              )}
              {station && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {station}
                </span>
              )}
              {match.referee && <span>Referee: {match.referee.name}</span>}
              {match.bestOf && match.bestOf > 1 && <span>Best of {match.bestOf}</span>}
            </div>
          </div>
          <Button type="button" variant="secondary" className="h-8 gap-1 text-xs" onClick={share}>
            <Share2 className="size-3.5" /> Share
          </Button>
        </div>
      </header>

      <section>
        <MatchResultView data={resultData} variant="card" />
        {match.sets && match.sets.length > 0 && (
          <div className="panel-card mt-3 overflow-x-auto rounded-xl p-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="py-1 pr-3 font-semibold">Team</th>
                  {match.sets.map((_, i) => (
                    <th key={i} className="px-2 py-1 text-center font-semibold">
                      Set {i + 1}
                    </th>
                  ))}
                  <th className="px-2 py-1 text-center font-semibold">Sets</th>
                </tr>
              </thead>
              <tbody>
                <SetRow
                  name={match.homeTeam?.name ?? 'Home'}
                  scores={match.sets.map((s) => s.home)}
                  opp={match.sets.map((s) => s.away)}
                  total={match.homeSetsWon}
                  winner={match.winnerTeamId === match.homeTeamId}
                />
                <SetRow
                  name={match.awayTeam?.name ?? 'Away'}
                  scores={match.sets.map((s) => s.away)}
                  opp={match.sets.map((s) => s.home)}
                  total={match.awaySetsWon}
                  winner={match.winnerTeamId === match.awayTeamId}
                />
              </tbody>
            </table>
          </div>
        )}
        {hasResult && match.reportedAt && (
          <p className="mt-2 text-right text-[11px] text-[var(--color-muted)]">
            Result recorded {formatWhen(match.reportedAt, tournament.timezone)}
          </p>
        )}
        <MatchVoteBar match={match} tournament={tournament} token={token} />
      </section>

      {canSelfReport && token && (
        <section className="gaming-card rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold">Report your result</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            You&apos;re a participant in this match. The host allows participants to report their own scores.
          </p>
          <MatchInlineResultForm match={match} tournament={tournament} token={token} slug={slug} />
        </section>
      )}

      {settings.allowMatchAttachments && (
        <AttachmentsSection
          match={match}
          slug={slug}
          token={token}
          canEdit={!!token && (canManage || isParticipant)}
        />
      )}

      <MatchComments matchId={match.id} enabled={settings.enableMatchComments === true} />
    </div>
  );
}

function SetRow({
  name,
  scores,
  opp,
  total,
  winner,
}: {
  name: string;
  scores: number[];
  opp: number[];
  total: number | null | undefined;
  winner: boolean;
}) {
  return (
    <tr className={winner ? 'font-semibold' : ''}>
      <td className="py-1 pr-3">{name}</td>
      {scores.map((s, i) => (
        <td
          key={i}
          className={`px-2 py-1 text-center tabular-nums ${s > (opp[i] ?? 0) ? 'text-[var(--color-ok)]' : ''}`}
        >
          {s}
        </td>
      ))}
      <td className="px-2 py-1 text-center font-bold tabular-nums">{total ?? '—'}</td>
    </tr>
  );
}

function AttachmentsSection({
  match,
  slug,
  token,
  canEdit,
}: {
  match: Match;
  slug: string;
  token?: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: (input: { attachmentUrl: string | null; attachmentName: string | null }) =>
      api(`/matches/${match.id}/attachment`, {
        method: 'PATCH',
        token: token!,
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success('Attachment updated');
      setLinkUrl('');
      setLinkName('');
      qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onFile = async (file: File) => {
    if (!token) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, token);
      await save.mutateAsync({ attachmentUrl: url, attachmentName: file.name.slice(0, 120) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="gaming-card rounded-2xl p-5">
      <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
        <Paperclip className="size-4" /> Attachments
      </h2>
      {match.attachmentUrl ? (
        <div className="panel-card mt-3 flex items-center gap-3 rounded-xl p-3">
          {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(match.attachmentUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.attachmentUrl} alt="" className="size-14 rounded-lg object-cover" />
          )}
          <a
            href={match.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm text-[var(--color-accent)] underline"
          >
            {match.attachmentName ?? match.attachmentUrl}
          </a>
          {canEdit && (
            <button
              type="button"
              className="text-[var(--color-muted)] hover:text-red-500"
              aria-label="Remove attachment"
              disabled={save.isPending}
              onClick={() => {
                if (confirm('Remove this attachment?')) {
                  save.mutate({ attachmentUrl: null, attachmentName: null });
                }
              }}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          No screenshot or proof attached yet.
        </p>
      )}

      {canEdit && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="h-8 gap-1 text-xs"
              disabled={uploading || save.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-3.5" /> {uploading ? 'Uploading…' : 'Upload screenshot'}
            </Button>
            <span className="text-[11px] text-[var(--color-muted)]">or paste a link</span>
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!linkUrl.trim()) return;
              save.mutate({
                attachmentUrl: linkUrl.trim(),
                attachmentName: linkName.trim() || null,
              });
            }}
          >
            <Input
              type="url"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="min-w-[200px] flex-1"
            />
            <Input
              placeholder="Label (optional)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              maxLength={120}
              className="w-44"
            />
            <Button type="submit" variant="secondary" className="h-9 gap-1 text-xs" disabled={save.isPending || !linkUrl.trim()}>
              <Link2 className="size-3.5" /> Attach link
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
