// Contracts for the account feature area. Owned by its workstream.
import { z } from 'zod';

export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

export const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'api',
  'www',
  'mail',
  'null',
  'undefined',
  'me',
  'settings',
  'login',
  'logout',
  'register',
  'signup',
  'dashboard',
  'inbox',
  'billing',
  'developer',
  'tournaments',
  'tournament',
  'communities',
  'community',
  'events',
  'event',
  'browse',
  'search',
  'bracket',
  'brackets',
  'moderator',
  'staff',
  'team',
  'teams',
  'user',
  'users',
  'profile',
  'about',
  'contact',
  'terms',
  'privacy',
] as const;

export function isReservedUsername(username: string): boolean {
  return (RESERVED_USERNAMES as readonly string[]).includes(username.toLowerCase());
}

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, 'Use 3–24 lowercase letters, numbers or underscores')
  .refine((v) => !isReservedUsername(v), 'That username is reserved');

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  username: usernameSchema.optional().nullable(),
  avatarUrl: z.string().trim().max(2048).optional().nullable(),
  bio: z.string().trim().max(300).optional().nullable(),
  timezone: z.string().trim().min(1).max(64).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
  countryCode: z.string().trim().min(2).max(8).optional().nullable(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(8).max(200),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(16).max(256),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const inboxNotifySchema = z.object({
  type: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional().nullable(),
  href: z.string().max(2048).optional().nullable(),
});
export type InboxNotifyInput = z.infer<typeof inboxNotifySchema>;

export const INBOX_PREF_DEFAULTS = {
  inApp: true,
  emailRegistration: true,
  emailMatchComments: false,
  emailMatchReady: true,
  emailFinalResults: true,
} as const;

export const inboxPreferencesSchema = z.object({
  inApp: z.boolean(),
  emailRegistration: z.boolean(),
  emailMatchComments: z.boolean(),
  emailMatchReady: z.boolean(),
  emailFinalResults: z.boolean(),
});
export type InboxPreferences = z.infer<typeof inboxPreferencesSchema>;

export const updateInboxPreferencesSchema = inboxPreferencesSchema.partial();
export type UpdateInboxPreferencesInput = z.infer<typeof updateInboxPreferencesSchema>;

export type InboxEmailChannel = Exclude<keyof InboxPreferences, 'inApp'>;

export type InboxPreferencesResponse = InboxPreferences & { persisted: true };

/** Curated IANA timezones for the account settings picker. */
export const ACCOUNT_TIMEZONES: string[] = [
  'UTC',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Jakarta',
  'Asia/Manila',
  'Australia/Sydney',
  'Australia/Perth',
  'Pacific/Auckland',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
];

export const LOCALE_OPTIONS = [{ value: 'en', label: 'English' }] as const;

export type PublicProfileStats = {
  tournamentsHosted: number;
  tournamentsPlayed: number;
  wins: number;
};

/** Initials for an avatar fallback ("Jane Doe" → "JD"). */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
