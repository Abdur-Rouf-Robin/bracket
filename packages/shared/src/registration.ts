// Contracts for the registration feature area. Owned by its workstream.
import { z } from 'zod';

export const REGISTRATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'WAITLISTED',
  'WITHDRAWN',
] as const;
export type RegistrationStatusValue = (typeof REGISTRATION_STATUSES)[number];

export const PAYMENT_STATUSES = ['FREE', 'UNPAID', 'PAID', 'REFUNDED'] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export const SKILL_LEVELS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'PRO', label: 'Pro' },
] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number]['value'];

export const REGISTRATION_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'phone',
  'select',
  'checkbox',
  'url',
] as const;
export type RegistrationFieldType = (typeof REGISTRATION_FIELD_TYPES)[number];

/** Mirrors `tournamentSettingsSchema.registrationFields[number]`. */
export type RegistrationFieldDef = {
  id: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  options?: string[];
  helpText?: string;
};

export const registrationFieldDefSchema = z.object({
  id: z.string().min(1).max(32),
  label: z.string().min(1).max(120),
  type: z.enum(REGISTRATION_FIELD_TYPES).default('text'),
  required: z.boolean().default(false),
  options: z.array(z.string().max(80)).optional(),
  helpText: z.string().max(240).optional(),
});

export const registrationPlayerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  isCaptain: z.boolean().optional().default(false),
});
export type RegistrationPlayer = z.infer<typeof registrationPlayerSchema>;

export const customFieldValueSchema = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
]);
export type CustomFieldValue = z.infer<typeof customFieldValueSchema>;

/** Public sign-up form submission (`POST /t/:slug/registrations`). */
export const registrationSubmitSchema = z.object({
  teamName: z.string().trim().min(1).max(80),
  players: z.array(registrationPlayerSchema).max(30).optional().default([]),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  countryCode: z.string().trim().min(2).max(8).optional().nullable(),
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO']).optional().nullable(),
  customFields: z.record(z.string(), customFieldValueSchema).optional().default({}),
  acceptWaiver: z.boolean().optional().default(false),
});
export type RegistrationSubmitInput = z.infer<typeof registrationSubmitSchema>;

/** Manager review (`PATCH /tournaments/:id/registrations/:regId`). */
export const registrationReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'WAITLISTED', 'PENDING']).optional(),
  notes: z.string().max(2000).optional().nullable(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
});
export type RegistrationReviewInput = z.infer<typeof registrationReviewSchema>;

/** Host adds a participant record directly (`POST /tournaments/:id/registrations/manual`). */
export const registrationManualSchema = z.object({
  teamName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  countryCode: z.string().trim().min(2).max(8).optional().nullable(),
  players: z.array(registrationPlayerSchema).max(30).optional().default([]),
  notes: z.string().max(2000).optional().nullable(),
});
export type RegistrationManualInput = z.infer<typeof registrationManualSchema>;

export const waitlistReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(512),
});
export type WaitlistReorderInput = z.infer<typeof waitlistReorderSchema>;

export const matchCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type MatchCommentInput = z.infer<typeof matchCommentSchema>;

/** Why a sign-up page is currently closed. */
export type RegistrationClosedReason =
  | 'HOST_LIST'
  | 'NOT_PUBLIC'
  | 'COMPLETED'
  | 'BRACKET_GENERATED'
  | 'NOT_OPEN_YET'
  | 'CLOSED'
  | 'FULL';

export type RegistrationFormConfig = {
  tournament: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    startAt: string | null;
    timezone: string;
    game: { id: string; name: string; category: string } | null;
  };
  isOpen: boolean;
  reason: RegistrationClosedReason | null;
  maxParticipants: number;
  approvedCount: number;
  pendingCount: number;
  waitlistCount: number;
  spotsLeft: number;
  waitlistEnabled: boolean;
  autoApprove: boolean;
  requireTeamRegistration: boolean;
  playersPerTeam: number;
  substituteSlots: number;
  allowSubstitutes: boolean;
  registrationFields: RegistrationFieldDef[];
  waiverText: string | null;
  entryFeeCents: number;
  currency: string;
  requireVerifiedEmail: boolean;
  restrictByCountry: boolean;
  allowedCountries: string[];
  collectSkillLevel: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  viewer: {
    loggedIn: boolean;
    emailVerified: boolean;
    email: string | null;
    name: string | null;
    countryCode: string | null;
    existingRegistration: {
      id: string;
      status: RegistrationStatusValue;
      waitlistPosition: number | null;
      paymentStatus: PaymentStatusValue;
    } | null;
  };
  checkIn: {
    required: boolean;
    opensAt: string | null;
    isOpenNow: boolean;
  };
};

export type CheckInStatus = {
  required: boolean;
  opensAt: string | null;
  closesAt: string | null;
  isOpenNow: boolean;
  checkedInCount: number;
  total: number;
};

/** Human label + tone for a registration status pill. */
export function registrationStatusLabel(status: RegistrationStatusValue): {
  label: string;
  tone: 'ok' | 'warn' | 'muted' | 'danger' | 'info';
} {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', tone: 'ok' };
    case 'PENDING':
      return { label: 'Pending', tone: 'warn' };
    case 'WAITLISTED':
      return { label: 'Waitlisted', tone: 'info' };
    case 'REJECTED':
      return { label: 'Rejected', tone: 'danger' };
    case 'WITHDRAWN':
    default:
      return { label: 'Withdrawn', tone: 'muted' };
  }
}

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'BDT', label: 'BDT — Bangladeshi Taka' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'PKR', label: 'PKR — Pakistani Rupee' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
] as const;

/**
 * Validate custom field answers against the host-defined field list.
 * Returns a map of fieldId → error message (empty when valid) and the
 * normalised values (numbers coerced, unknown ids dropped).
 */
export function validateCustomFields(
  fields: RegistrationFieldDef[],
  values: Record<string, CustomFieldValue | null | undefined>,
): { errors: Record<string, string>; values: Record<string, CustomFieldValue> } {
  const errors: Record<string, string> = {};
  const out: Record<string, CustomFieldValue> = {};
  for (const field of fields) {
    const raw = values[field.id];
    const empty =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '') ||
      (field.type === 'checkbox' && raw === false);
    if (empty) {
      if (field.required) errors[field.id] = `${field.label} is required`;
      continue;
    }
    switch (field.type) {
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(n)) {
          errors[field.id] = `${field.label} must be a number`;
        } else {
          out[field.id] = n;
        }
        break;
      }
      case 'checkbox': {
        const b = raw === true || raw === 'true' || raw === 1;
        out[field.id] = b;
        break;
      }
      case 'select': {
        const s = String(raw);
        if (field.options?.length && !field.options.includes(s)) {
          errors[field.id] = `Choose one of the listed options for ${field.label}`;
        } else {
          out[field.id] = s;
        }
        break;
      }
      case 'email': {
        const s = String(raw).trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
          errors[field.id] = `${field.label} must be a valid email`;
        } else {
          out[field.id] = s;
        }
        break;
      }
      case 'url': {
        const s = String(raw).trim();
        try {
          new URL(s);
          out[field.id] = s;
        } catch {
          errors[field.id] = `${field.label} must be a valid URL`;
        }
        break;
      }
      case 'phone': {
        const s = String(raw).trim();
        if (!/^[+\d][\d\s().-]{4,30}$/.test(s)) {
          errors[field.id] = `${field.label} must be a valid phone number`;
        } else {
          out[field.id] = s;
        }
        break;
      }
      case 'textarea':
      case 'text':
      default:
        out[field.id] = String(raw).slice(0, 2000);
    }
  }
  return { errors, values: out };
}
