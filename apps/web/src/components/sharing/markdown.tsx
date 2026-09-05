'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * Tiny, dependency-free markdown renderer for tournament rules / descriptions.
 * Supports: # headings (1-3), paragraphs, **bold**, *italic*, `code`,
 * [links](https://…), unordered (-, *) and ordered (1.) lists, blockquotes and
 * horizontal rules. Output is React elements — never raw HTML — so it is safe
 * against injection. Links are restricted to http(s)/mailto.
 */

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h;
  if (h.startsWith('/')) return h;
  return null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Order matters: code, bold, italic, link.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith('`')) {
      out.push(
        <code key={key} className="rounded bg-[var(--color-surface)] px-1 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('**')) {
      out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('*')) {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      const href = lm ? safeHref(lm[2]) : null;
      if (lm && href) {
        out.push(
          <a
            key={key}
            href={href}
            target={href.startsWith('/') ? undefined : '_blank'}
            rel="noreferrer noopener"
            className="text-[var(--color-accent)] underline underline-offset-2"
          >
            {lm[1]}
          </a>,
        );
      } else {
        out.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'hr' };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ') });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: 'h', level: h[1].length as 1 | 2 | 3, text: h[2] });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushPara();
      flushList();
      blocks.push({ type: 'hr' });
      continue;
    }
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      flushList();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === 'quote') prev.text += ` ${q[1]}`;
      else blocks.push({ type: 'quote', text: q[1] });
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

export function Markdown({ source, className }: { source: string | null | undefined; className?: string }) {
  if (!source?.trim()) return null;
  const blocks = parseBlocks(source);
  return (
    <div className={className ?? 'space-y-3 text-sm leading-relaxed'}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.type) {
          case 'h': {
            const cls =
              b.level === 1
                ? 'font-display text-2xl font-bold'
                : b.level === 2
                  ? 'font-display text-xl font-semibold'
                  : 'font-display text-lg font-semibold';
            const Tag = (`h${b.level + 1}` as 'h2' | 'h3' | 'h4');
            return (
              <Tag key={k} className={cls}>
                {renderInline(b.text, k)}
              </Tag>
            );
          }
          case 'p':
            return <p key={k}>{renderInline(b.text, k)}</p>;
          case 'ul':
            return (
              <ul key={k} className="list-disc space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={`${k}-${j}`}>{renderInline(it, `${k}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={k} className="list-decimal space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={`${k}-${j}`}>{renderInline(it, `${k}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote key={k} className="border-l-2 border-[var(--color-accent)] pl-3 text-[var(--color-muted)]">
                {renderInline(b.text, k)}
              </blockquote>
            );
          case 'hr':
            return <hr key={k} className="border-[var(--color-line)]" />;
          default:
            return <Fragment key={k} />;
        }
      })}
    </div>
  );
}
