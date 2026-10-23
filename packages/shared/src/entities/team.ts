import { z } from 'zod';

import { BrazilianStateCodeSchema } from './brazilianStates.js';
import {
  buildCarNumberSchema,
  buildOptionalMediaIdSchema,
  buildOptionalTextSchema,
  buildRequiredTextSchema,
} from './entityFieldSchemas.js';
import { reportKeysListedTwice } from './entityKeysListedOnce.js';
import { ptBREntities } from './ptBREntities.js';

const labels = ptBREntities.teamFieldLabels;

/**
 * One team of the entity library, keyed by its car number: the same key the positions
 * shape uses, so a car in the race and its team join with no mapping (an item binds
 * `positions.entryOfCar.<field>` and references the team of the same car).
 * The images are optional on purpose: a CSV never carries one, and the team card still
 * looks finished without a logo. `city` and `state` are optional too (gate 2 of PR #23,
 * João's call): an entry list often names neither, and the team card drops its place line
 * when they are missing rather than refusing the team.
 */
export const TeamSchema = z.object({
  carNumber: buildCarNumberSchema(labels.carNumber),
  /** The team's own name: "Baja UFPR". */
  teamName: buildRequiredTextSchema(labels.teamName, 60),
  /** The school's short form, as the shapes carry it: "UFPR". */
  schoolName: buildRequiredTextSchema(labels.schoolName, 30),
  /** The school's full name, for a card with room for it: "Universidade Federal do Paraná". */
  schoolFullName: buildOptionalTextSchema(labels.schoolFullName, 120),
  city: buildOptionalTextSchema(labels.city, 60),
  state: BrazilianStateCodeSchema.optional(),
  logoMediaId: buildOptionalMediaIdSchema(labels.logoMediaId),
  carPhotoMediaId: buildOptionalMediaIdSchema(labels.carPhotoMediaId),
});

/** A team that has passed TeamSchema. */
export type Team = z.infer<typeof TeamSchema>;

/** A list of teams in which each car number appears once (a slice, or an import). */
export function buildListOfTeamsSchema() {
  return z.array(TeamSchema).superRefine((teams, context) => {
    reportKeysListedTwice(
      teams.map((team) => team.carNumber),
      'carNumber',
      ptBREntities.sliceProblems.carListedTwice,
      context,
    );
  });
}

/** The `teams` slice: every team of the library, each car number once. Saved. */
export const TeamsSchema = buildListOfTeamsSchema();

/** The `teams` slice, after validation. */
export type Teams = z.infer<typeof TeamsSchema>;
