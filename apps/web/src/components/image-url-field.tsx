'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { API_URL } from '@/lib/api';

export async function uploadImage(
  file: File,
  token: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Upload failed');
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function ImageUrlField({
  label,
  hint,
  value,
  onChange,
  token,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  token?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  async function onFile(file: File | null) {
    if (!file || !token) return;
    setUploading(true);
    setErr('');
    try {
      const url = await uploadImage(file, token);
      onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {label ? <label className="text-sm font-medium">{label}</label> : null}
      <div className="mt-1 flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
          className="flex-1"
        />
        {token && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? '…' : 'Upload'}
            </Button>
          </>
        )}
      </div>
      {hint && (
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">{hint}</p>
      )}
      {value && (
        <img
          src={value}
          alt=""
          className="mt-2 h-16 w-auto max-w-full rounded border border-[var(--color-line)] object-contain"
        />
      )}
      {err && <p className="mt-1 text-xs text-[var(--color-danger)]">{err}</p>}
    </div>
  );
}
