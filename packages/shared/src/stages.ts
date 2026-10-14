import { z } from 'zod';

export const STAGE_FORMATS = [
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'SWISS',
  'GAUNTLET',
] as const;

export const createStageSchema = z.object({
  name: z.string().trim().min(1).max(80),
  format: z.enum(STAGE_FORMATS),
  advanceCount: z.number().int().min(2).max(256).optional().nullable(),
});
export type CreateStageInput = z.infer<typeof createStageSchema>;

export const savedSquadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  players: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});
export type SavedSquadInput = z.infer<typeof savedSquadSchema>;

export const importSquadSchema = z.object({
  squadId: z.string().min(1),
});
export type ImportSquadInput = z.infer<typeof importSquadSchema>;
