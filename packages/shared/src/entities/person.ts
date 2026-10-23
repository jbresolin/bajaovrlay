import { z } from 'zod';

import {
  buildCarNumberSchema,
  buildOptionalMediaIdSchema,
  buildRecordIdSchema,
  buildRequiredTextSchema,
} from './entityFieldSchemas.js';
import { reportKeysListedTwice } from './entityKeysListedOnce.js';
import { ptBREntities } from './ptBREntities.js';

const labels = ptBREntities.personFieldLabels;

/**
 * One person of the entity library, for a lower third: a narrator, a judge, a team
 * captain. `carNumber` names the team of a team member (the key of the teams slice) and
 * is left out for staff; it is not checked against the teams, so a person typed before
 * their team is still saved.
 */
export const PersonSchema = z.object({
  personId: buildRecordIdSchema(labels.personId),
  name: buildRequiredTextSchema(labels.name, 80),
  /** What the lower third prints under the name: "Narrador", "Juiz de segurança". */
  role: buildRequiredTextSchema(labels.role, 60),
  carNumber: buildCarNumberSchema(labels.carNumber).optional(),
  photoMediaId: buildOptionalMediaIdSchema(labels.photoMediaId),
});

/** A person that has passed PersonSchema. */
export type Person = z.infer<typeof PersonSchema>;

/** A list of people in which each id appears once (a slice, or an import). */
export function buildListOfPeopleSchema() {
  return z.array(PersonSchema).superRefine((people, context) => {
    reportKeysListedTwice(
      people.map((person) => person.personId),
      'personId',
      ptBREntities.sliceProblems.idListedTwice,
      context,
    );
  });
}

/** The `people` slice: every person of the library, each id once. Saved. */
export const PeopleSchema = buildListOfPeopleSchema();

/** The `people` slice, after validation. */
export type People = z.infer<typeof PeopleSchema>;
