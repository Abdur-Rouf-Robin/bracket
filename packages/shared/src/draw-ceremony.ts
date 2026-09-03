import type { DrawAuditEntry } from './rng';

export type DrawCeremonyStep = {
  index: number;
  teamId: string;
  teamName: string;
  groupId: string;
  groupName: string;
};

export type DrawCeremonyPlan = {
  seed: string;
  seedHash: number;
  steps: DrawCeremonyStep[];
  audit: DrawAuditEntry;
};
