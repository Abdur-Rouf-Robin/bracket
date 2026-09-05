'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Copy, ExternalLink, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  REGISTRATION_FIELD_TYPES,
  formatMoney,
} from '@bracket/shared';
import type { RegistrationFieldDef, RegistrationFieldType, TournamentSettings } from '@bracket/shared';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  FieldRow,
  SectionTitle,
  Toggle,
  isoToLocalInput,
  localInputToIso,
} from '@/components/registrations/registration-ui';

const FIELD_TYPE_LABELS: Record<RegistrationFieldType, string> = {
  text: 'Short text',
  textarea: 'Paragraph',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  select: 'Dropdown',
  checkbox: 'Checkbox',
  url: 'URL',
};

function newFieldId() {
  return `f_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/**
 * Registration settings (sign-up page, approval, waitlist, custom fields, waiver, fees, check-in window)
 */
export function RegistrationSettingsPanel({
  tournament,
  token,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  sub: string;
}) {
  const qc = useQueryClient();
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: (patch: Partial<TournamentSettings>) =>
      api(`/tournaments/${tournament.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ settings: patch }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
      qc.invalidateQueries({ queryKey: ['registration-config', tournament.slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function patch(partial: Partial<TournamentSettings>) {
    mutation.mutate(partial);
  }

  if (!token) return null;

  const signupUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/t/${tournament.slug}/register`
      : `/t/${tournament.slug}/register`;
  const openSignup = settings.registrationMode === 'OPEN_SIGNUP';
  const fee = settings.entryFeeCents ?? 0;

  return (
    <div className="space-y-6">
      <section className="panel-card space-y-4 rounded-xl p-4">
        <SectionTitle
          title="Participant intake"
          description="Choose how participants get into this tournament."
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={`choice-btn rounded-xl p-4 text-left ${!openSignup ? 'choice-btn-active' : ''}`}
            onClick={() => patch({ registrationMode: 'HOST_LIST' })}
          >
            <p className="font-semibold">Host-managed list</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              You add participants yourself. No public sign-up page.
            </p>
          </button>
          <button
            type="button"
            className={`choice-btn rounded-xl p-4 text-left ${openSignup ? 'choice-btn-active' : ''}`}
            onClick={() => patch({ registrationMode: 'OPEN_SIGNUP' })}
          >
            <p className="font-semibold">Sign-up page</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Participants register through a public form with approval, waitlist and fees.
            </p>
          </button>
        </div>

        {openSignup && (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/40 p-3">
              <code className="min-w-0 flex-1 truncate text-xs text-[var(--color-muted)]">{signupUrl}</code>
              <Button
                type="button"
                variant="secondary"
                className="h-8 text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(signupUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <a href={signupUrl} target="_blank" rel="noreferrer">
                <Button type="button" variant="ghost" className="h-8 text-xs">
                  <ExternalLink className="mr-1 size-3.5" /> Open
                </Button>
              </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Sign-up page is public"
                hint="When off, only you can see the form (useful while you set it up)."
                checked={settings.signupPagePublic !== false}
                onChange={(v) => patch({ signupPagePublic: v })}
              />
              <Toggle
                label="Auto-approve registrations"
                hint="Free registrations are confirmed instantly. Paid ones confirm after payment."
                checked={settings.autoApproveRegistrations !== false}
                onChange={(v) => patch({ autoApproveRegistrations: v })}
              />
              <Toggle
                label="Enable waitlist"
                hint="When the tournament is full, new sign-ups queue up in order."
                checked={settings.waitlistEnabled !== false}
                onChange={(v) => patch({ waitlistEnabled: v })}
              />
              <Toggle
                label="Require verified email"
                hint="Only accounts with a confirmed email can register."
                checked={settings.requireVerifiedEmail === true}
                onChange={(v) => patch({ requireVerifiedEmail: v })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DateTimeField
                label="Registration opens"
                value={settings.registrationOpensAt ?? null}
                onCommit={(iso) => patch({ registrationOpensAt: iso })}
              />
              <DateTimeField
                label="Registration closes"
                value={settings.registrationClosesAt ?? null}
                onCommit={(iso) => patch({ registrationClosesAt: iso })}
              />
            </div>
          </>
        )}
      </section>

      <section className="panel-card space-y-4 rounded-xl p-4">
        <SectionTitle title="Capacity & teams" />
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Max participants"
            min={2}
            max={512}
            value={settings.maxParticipants ?? 32}
            onCommit={(v) => patch({ maxParticipants: v })}
          />
          <NumberField
            label="Players per team"
            min={1}
            max={20}
            value={settings.playersPerTeam ?? 1}
            onCommit={(v) => patch({ playersPerTeam: v })}
            hint={settings.playersPerTeam === 1 ? 'Solo — the form asks for a display name.' : undefined}
          />
          <NumberField
            label="Substitute slots"
            min={0}
            max={10}
            value={settings.substituteSlots ?? 0}
            disabled={!settings.allowSubstitutes}
            onCommit={(v) => patch({ substituteSlots: v })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Require full roster at sign-up"
            hint="Participants must enter every starter's name."
            checked={settings.requireTeamRegistration === true}
            onChange={(v) => patch({ requireTeamRegistration: v })}
          />
          <Toggle
            label="Allow substitute players"
            checked={settings.allowSubstitutes === true}
            onChange={(v) => patch({ allowSubstitutes: v })}
          />
          <Toggle
            label="Collect skill level"
            hint="Beginner / Intermediate / Advanced / Pro."
            checked={settings.collectSkillLevel === true}
            onChange={(v) => patch({ collectSkillLevel: v })}
          />
          <Toggle
            label="Region lock"
            hint="Only participants from selected countries may register."
            checked={settings.restrictByCountry === true}
            onChange={(v) => patch({ restrictByCountry: v })}
          />
        </div>
        {settings.restrictByCountry && (
          <div className="rounded-lg border border-[var(--color-line)] p-3">
            <p className="mb-2 text-sm font-medium">Allowed countries</p>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRY_OPTIONS.map((c) => {
                const active = settings.allowedCountries?.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    className={`choice-btn rounded-full px-3 py-1 text-xs ${active ? 'choice-btn-active' : ''}`}
                    onClick={() => {
                      const cur = settings.allowedCountries ?? [];
                      patch({
                        allowedCountries: active
                          ? cur.filter((x) => x !== c.code)
                          : [...cur, c.code],
                      });
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="panel-card space-y-4 rounded-xl p-4">
        <SectionTitle
          title="Entry fee"
          description="Collected via Stripe Checkout when a participant submits the form."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <MoneyField
            label="Amount"
            cents={fee}
            currency={settings.currency ?? 'USD'}
            onCommit={(cents) => patch({ entryFeeCents: cents })}
          />
          <FieldRow label="Currency">
            <Select
              value={settings.currency ?? 'USD'}
              onChange={(v) => v && patch({ currency: v })}
              options={CURRENCY_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
            />
          </FieldRow>
          <div className="rounded-lg border border-dashed border-[var(--color-line)] p-3 text-xs text-[var(--color-muted)]">
            {fee > 0 ? (
              <>
                Participants pay <span className="text-[var(--color-ink)]">{formatMoney(fee, settings.currency ?? 'USD')}</span>.
                Requires <code>STRIPE_SECRET_KEY</code> on the server; payments are confirmed by
                webhook (with a manual “Verify” fallback in the Registrations tab).
              </>
            ) : (
              'Free entry. Set an amount to enable Stripe Checkout.'
            )}
          </div>
        </div>
      </section>

      <section className="panel-card space-y-4 rounded-xl p-4">
        <SectionTitle
          title="Waiver & rules"
          description="Shown on the sign-up page. Participants must tick a box to accept it."
        />
        <WaiverField
          value={settings.waiverText ?? ''}
          onCommit={(text) => patch({ waiverText: text || null })}
        />
      </section>

      <section className="panel-card space-y-4 rounded-xl p-4">
        <SectionTitle
          title="Custom questions"
          description="Extra fields on the sign-up form. Drag to reorder."
        />
        <CustomFieldsBuilder
          fields={(settings.registrationFields ?? []) as RegistrationFieldDef[]}
          onChange={(fields) => patch({ registrationFields: fields })}
        />
      </section>

      <section className="panel-card space-y-4 rounded-xl p-4">
        <SectionTitle title="Check-in & match day" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Require check-in"
            hint="Participants confirm attendance before the bracket starts."
            checked={settings.requireCheckIn === true}
            onChange={(v) => patch({ requireCheckIn: v })}
          />
          <NumberField
            label="Check-in opens (minutes before start)"
            min={0}
            max={2880}
            value={settings.checkInOpensMinutesBefore ?? 60}
            disabled={!settings.requireCheckIn}
            onCommit={(v) => patch({ checkInOpensMinutesBefore: v })}
          />
          <Toggle
            label="Participants may report scores"
            hint="Team captains can submit results for their own matches."
            checked={settings.allowParticipantsReportScores === true}
            onChange={(v) => patch({ allowParticipantsReportScores: v })}
          />
          <Toggle
            label="Match attachments"
            hint="Allow screenshots / proof uploads on match pages."
            checked={settings.allowMatchAttachments === true}
            onChange={(v) => patch({ allowMatchAttachments: v })}
          />
          <Toggle
            label="Match comments"
            hint="Public discussion thread on every match page."
            checked={settings.enableMatchComments !== false}
            onChange={(v) => patch({ enableMatchComments: v })}
          />
          <Toggle
            label="Participant confirmation required"
            hint="Ask participants to confirm their spot after approval."
            checked={settings.participantConfirmationRequired === true}
            onChange={(v) => patch({ participantConfirmationRequired: v })}
          />
        </div>
      </section>

      {mutation.isPending && (
        <p className="text-xs text-[var(--color-muted)]">Saving…</p>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  hint,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  disabled?: boolean;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <FieldRow label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Math.max(min, Math.min(max, Number(draft)));
          if (Number.isFinite(n) && n !== value) onCommit(n);
          else setDraft(String(value));
        }}
      />
    </FieldRow>
  );
}

function MoneyField({
  label,
  cents,
  currency,
  onCommit,
}: {
  label: string;
  cents: number;
  currency: string;
  onCommit: (cents: number) => void;
}) {
  const [draft, setDraft] = useState((cents / 100).toFixed(2));
  useEffect(() => setDraft((cents / 100).toFixed(2)), [cents]);
  return (
    <FieldRow label={label} hint={cents > 0 ? formatMoney(cents, currency) : 'Free'}>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Math.round(Number(draft) * 100);
          if (Number.isFinite(n) && n >= 0 && n !== cents) onCommit(n);
          else setDraft((cents / 100).toFixed(2));
        }}
      />
    </FieldRow>
  );
}

function DateTimeField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string | null;
  onCommit: (iso: string | null) => void;
}) {
  const [draft, setDraft] = useState(isoToLocalInput(value));
  useEffect(() => setDraft(isoToLocalInput(value)), [value]);
  return (
    <FieldRow label={label} hint="Stored in UTC; shown in your local time.">
      <div className="flex gap-2">
        <input
          type="datetime-local"
          className="field-select"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const iso = localInputToIso(draft);
            if (iso !== (value ?? null)) onCommit(iso);
          }}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-2 text-xs"
            onClick={() => onCommit(null)}
            title="Clear"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </FieldRow>
  );
}

function WaiverField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const dirty = draft !== value;
  return (
    <div>
      <textarea
        className="field-textarea min-h-40"
        value={draft}
        maxLength={8000}
        placeholder="e.g. By registering you agree to the code of conduct, streaming consent…"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">{draft.length}/8000</span>
        <div className="flex gap-2">
          {dirty && (
            <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => setDraft(value)}>
              Discard
            </Button>
          )}
          <Button type="button" className="h-8 text-xs" disabled={!dirty} onClick={() => onCommit(draft.trim())}>
            Save waiver
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom fields builder
// ---------------------------------------------------------------------------

function CustomFieldsBuilder({
  fields,
  onChange,
}: {
  fields: RegistrationFieldDef[];
  onChange: (fields: RegistrationFieldDef[]) => void;
}) {
  const [editing, setEditing] = useState<RegistrationFieldDef | null>(null);
  const [isNew, setIsNew] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = useMemo(() => fields.map((f) => f.id), [fields]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(fields, from, to));
  }

  function save(field: RegistrationFieldDef) {
    const clean: RegistrationFieldDef = {
      ...field,
      label: field.label.trim(),
      helpText: field.helpText?.trim() || undefined,
      options:
        field.type === 'select'
          ? (field.options ?? []).map((o) => o.trim()).filter(Boolean)
          : undefined,
    };
    if (!clean.label) {
      toast.error('Give the question a label');
      return;
    }
    if (clean.type === 'select' && !(clean.options?.length)) {
      toast.error('Add at least one option for a dropdown');
      return;
    }
    onChange(
      isNew ? [...fields, clean] : fields.map((f) => (f.id === clean.id ? clean : f)),
    );
    setEditing(null);
  }

  return (
    <div className="space-y-3">
      {fields.length === 0 && !editing && (
        <p className="rounded-lg border border-dashed border-[var(--color-line)] p-4 text-center text-sm text-[var(--color-muted)]">
          No custom questions yet. Add things like Discord handle, jersey size or in-game ID.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {fields.map((f) => (
              <SortableFieldItem
                key={f.id}
                field={f}
                onEdit={() => {
                  setIsNew(false);
                  setEditing({ ...f, options: f.options ? [...f.options] : undefined });
                }}
                onDelete={() => {
                  if (confirm(`Remove "${f.label}"?`)) onChange(fields.filter((x) => x.id !== f.id));
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {editing ? (
        <FieldEditor
          field={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => save(editing)}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="h-8 text-xs"
          onClick={() => {
            setIsNew(true);
            setEditing({ id: newFieldId(), label: '', type: 'text', required: false });
          }}
        >
          <Plus className="mr-1 size-3.5" /> Add question
        </Button>
      )}
    </div>
  );
}

function SortableFieldItem({
  field,
  onEdit,
  onDelete,
}: {
  field: RegistrationFieldDef;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/40 p-2.5 text-sm"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {field.label}
          {field.required && <span className="ml-1 text-[var(--color-danger)]">*</span>}
        </p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {FIELD_TYPE_LABELS[field.type]}
          {field.type === 'select' && field.options?.length ? ` · ${field.options.join(', ')}` : ''}
          {field.helpText ? ` · ${field.helpText}` : ''}
        </p>
      </div>
      <Button type="button" variant="ghost" className="h-7 px-2" onClick={onEdit} title="Edit">
        <Pencil className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-7 px-2 text-[var(--color-danger)]"
        onClick={onDelete}
        title="Delete"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

function FieldEditor({
  field,
  onChange,
  onCancel,
  onSave,
}: {
  field: RegistrationFieldDef;
  onChange: (f: RegistrationFieldDef) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [optionsText, setOptionsText] = useState((field.options ?? []).join('\n'));
  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldRow label="Label">
          <Input
            value={field.label}
            maxLength={120}
            placeholder="e.g. Discord username"
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            autoFocus
          />
        </FieldRow>
        <FieldRow label="Type">
          <Select
            value={field.type}
            onChange={(v) => v && onChange({ ...field, type: v as RegistrationFieldType })}
            options={REGISTRATION_FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))}
          />
        </FieldRow>
      </div>
      <FieldRow label="Help text (optional)">
        <Input
          value={field.helpText ?? ''}
          maxLength={240}
          onChange={(e) => onChange({ ...field, helpText: e.target.value })}
        />
      </FieldRow>
      {field.type === 'select' && (
        <FieldRow label="Options (one per line)">
          <textarea
            className="field-textarea min-h-24"
            value={optionsText}
            onChange={(e) => {
              setOptionsText(e.target.value);
              onChange({ ...field, options: e.target.value.split('\n') });
            }}
          />
        </FieldRow>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-accent)]"
          checked={field.required}
          onChange={(e) => onChange({ ...field, required: e.target.checked })}
        />
        Required
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-8 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" className="h-8 text-xs" onClick={onSave}>
          Save question
        </Button>
      </div>
    </div>
  );
}
