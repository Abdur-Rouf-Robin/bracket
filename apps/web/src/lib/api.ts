import { getViewToken, slugFromApiPath } from './view-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Turn Nest/Zod error bodies into a short user-facing string. */
function formatApiErrorBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const message = record.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && message.length) {
    return message.map(String).join(', ');
  }
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error;
  }
  const fieldErrors = record.fieldErrors as Record<string, string[]> | undefined;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const parts = Object.entries(fieldErrors).flatMap(([field, msgs]) =>
      (msgs ?? []).map((m) => `${field}: ${m}`),
    );
    if (parts.length) return parts.join('; ');
  }
  const formErrors = record.formErrors as string[] | undefined;
  if (Array.isArray(formErrors) && formErrors.length) {
    return formErrors.join('; ');
  }
  return null;
}

export async function api<T>(
  path: string,
  options: RequestInit & {
    token?: string | null;
    timeoutMs?: number;
    /** Spectator view token for password-protected tournaments. Auto-read from storage for `/t/:slug…` paths. */
    viewToken?: string | null;
  } = {},
): Promise<T> {
  const { token, headers, timeoutMs = 12000, viewToken, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resolvedViewToken = viewToken ?? null;
  if (resolvedViewToken === null && viewToken === undefined) {
    const slug = slugFromApiPath(path);
    if (slug) resolvedViewToken = getViewToken(slug);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal: rest.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(resolvedViewToken ? { 'x-view-token': resolvedViewToken } : {}),
        ...headers,
      },
    });

    if (!res.ok) {
      let message = res.statusText;
      try {
        const body = await res.json();
        message =
          formatApiErrorBody(body) ??
          (typeof body === 'string' ? body : JSON.stringify(body));
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, String(message));
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out — is the API running on port 3001?');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export { API_URL };
