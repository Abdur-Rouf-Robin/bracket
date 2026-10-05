import { z } from 'zod';

export const DEFAULT_CIRCUIT_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

export const createCircuitSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens')
    .optional(),
  description: z.string().max(4000).optional().nullable(),
  communityId: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
  points: z.array(z.number().int().min(0).max(1000)).min(1).max(64).optional(),
});
export type CreateCircuitInput = z.infer<typeof createCircuitSchema>;

export const attachCircuitTournamentSchema = z.object({
  tournamentId: z.string().min(1),
});
export type AttachCircuitTournamentInput = z.infer<typeof attachCircuitTournamentSchema>;
