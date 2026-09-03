'use client';

import { Button } from '@/components/ui/button';
import type { TournamentSettings } from '@bracket/shared';

type CustomField = NonNullable<TournamentSettings['predictionCustomFields']>[number];

export function PredictionCustomFieldsEditor({
  fields,
  onChange,
}: {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}) {
  function updateField(index: number, patch: Partial<CustomField>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next);
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-line)] p-3">
      <p className="text-sm font-medium">Prediction custom fields</p>
      {fields.length === 0 && (
        <p className="text-xs text-[var(--color-muted)]">
          No custom fields yet — add one for predictors to fill in.
        </p>
      )}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid gap-2 rounded-md border border-[var(--color-line)]/60 p-2 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <div>
            <label className="text-xs">Field ID</label>
            <input
              className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
              value={field.id}
              onChange={(e) => updateField(index, { id: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs">Label</label>
            <input
              className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
              value={field.label}
              onChange={(e) => updateField(index, { label: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs">Type</label>
            <select
              className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
              value={field.type}
              onChange={(e) =>
                updateField(index, { type: e.target.value as 'text' | 'number' })
              }
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="ghost" onClick={() => removeField(index)}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          onChange([
            ...fields,
            {
              id: `field_${fields.length + 1}`,
              label: `Custom field ${fields.length + 1}`,
              type: 'text',
            },
          ])
        }
      >
        Add field
      </Button>
    </div>
  );
}
