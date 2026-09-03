'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE } from '@/lib/auth-cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const AUTH_MAX_AGE = 60 * 60 * 24 * 7;

export type LoginActionState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/');
  const destination = next.startsWith('/') ? next : '/';

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return {
      error:
        'Cannot reach the API — start it with npm run dev:api on port 3001',
    };
  }

  if (!res.ok) {
    let message = 'Invalid email or password';
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
      if (Array.isArray(message)) message = message.join(', ');
    } catch {
      /* ignore */
    }
    return { error: String(message) };
  }

  const data = (await res.json()) as {
    accessToken: string;
    user: { id: string; email: string; name: string };
  };

  const jar = await cookies();
  jar.set(AUTH_COOKIE, '1', {
    path: '/',
    maxAge: AUTH_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });
  jar.set('bracket_token', data.accessToken, {
    path: '/',
    maxAge: AUTH_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });
  jar.set('bracket_user', JSON.stringify(data.user), {
    path: '/',
    maxAge: AUTH_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });

  redirect(destination);
}
