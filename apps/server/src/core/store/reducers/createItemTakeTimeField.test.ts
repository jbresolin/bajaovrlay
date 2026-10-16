/**
 * createItem and the fields that may say "the moment of the take" (apps/server)
 *
 * What this module is for:
 *   An item field may say `{ kind: 'takeTime' }` instead of holding a value: "the server
 *   fills this with the moment the item goes on air". The server writes its own moment
 *   only into a field the graphic's schema declares as a whole number marked
 *   `v_baja.role: "wallClock"`. createItem applies that rule when the item is saved, so
 *   the operator hears of a wrong field while preparing the rundown and not when
 *   pressing Space on air. It is the same check, with the same refusal, as at the take.
 *
 * What these tests prove:
 *   - A takeTime value on the race clock's reference moment is accepted and stored as
 *     takeTime; items made only of typed values are accepted whatever their fields.
 *   - A takeTime value on a whole number without the wall-clock mark, on a field the
 *     graphic does not declare, or on any field of a graphic with no data schema is
 *     refused with INVALID_GRAPHIC_DATA and the pt-BR message the take gives.
 *   - A refused create changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - The same check at the take, which stays because a manifest can change between the
 *     save and the take; takeItemTakeTimeOnWrongField.test.ts.
 *   - How the schema is read; graphicSchemaProperties.test.ts.
 *   - Whether typed values suit the graphic; that is still only checked at the take.
 */
import type { CreateItemCommand, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockFields,
  buildEnduroStartItem,
  buildRaceDaySlicesWithTheRaceClockSchema,
  contextOfTheRundownCommand,
  mainSessionRundownId,
  podiumRundownId,
} from './rundownSlices.testSupport.js';

/** Builds the createItem for "Chegada do enduro", a race clock item with the given fields. */
function buildCreateEnduroFinishCommand(fields: ItemFields): CreateItemCommand {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: mainSessionRundownId },
    graphicId: 'race-clock',
    layerId: 'clock',
    fields,
    label: 'Chegada do enduro',
    color: 'neutral',
    notes: '',
  };
}

/** Builds the createItem for "Pódio — Baja UFSC", a lower third item with the given fields. */
function buildCreatePodiumTeamCommand(fields: ItemFields): CreateItemCommand {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: podiumRundownId },
    graphicId: 'team-lower-third',
    layerId: 'lower-third',
    fields,
    label: 'Pódio — Baja UFSC',
    color: 'highlight',
    notes: '',
  };
}

const lowerThirdFieldsOfTeam17: ItemFields = {
  teamNumber: { kind: 'literal', value: 17 },
  teamName: { kind: 'literal', value: 'Baja UFSC' },
};

const acceptedCreateScenarios: Array<{ name: string; command: CreateItemCommand }> = [
  // The case takeTime exists for: a clock that starts counting when the item goes on air.
  {
    name: "accepts takeTime on the race clock's reference moment, a wall-clock field",
    command: buildCreateEnduroFinishCommand({
      ...buildEnduroClockFields('checkered'),
      referenceWallClockMs: { kind: 'takeTime' },
    }),
  },
  // Typed values are not the server's moment, so the wall-clock rule does not concern them.
  {
    name: 'accepts a race clock item made only of typed values',
    command: buildCreateEnduroFinishCommand(buildEnduroClockFields('checkered')),
  },
  // A graphic without a data schema still takes typed values; only a stamp is refused.
  {
    name: 'accepts typed values for the lower third, which has no data schema',
    command: buildCreatePodiumTeamCommand(lowerThirdFieldsOfTeam17),
  },
];

describe('createItem with fields the server may store', () => {
  it.each(acceptedCreateScenarios)('$name', ({ command }) => {
    // Arrange: a race day with one item, and the race clock registered with its schema.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildEnduroStartItem(0)],
    });

    // Act: create the item of this scenario.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: created, holding its fields exactly as the command sent them.
    expect(outcome.status, 'the item must be created').toBe('applied');
    const itemsAfter = outcome.status === 'applied' ? outcome.slices.items : [];
    const newItem = itemsAfter.find((item) => item.id === contextOfTheRundownCommand.newItemId);
    expect(newItem?.fields, 'the stored item must keep the fields as they were sent').toEqual(
      command.fields,
    );
  });
});

const refusedCreateScenarios: Array<{
  name: string;
  command: CreateItemCommand;
  expectedMessage: string;
}> = [
  // The case the check exists for: the reference TIME is a whole number but a duration.
  // Stamped with a date in milliseconds it would show about fifty-six years on air.
  {
    name: "refuses takeTime on the race clock's reference time, a whole number that is not a moment",
    command: buildCreateEnduroFinishCommand({
      ...buildEnduroClockFields('checkered'),
      referenceTimeMs: { kind: 'takeTime' },
    }),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A field the schema does not declare: nothing says it is a moment.
  {
    name: 'refuses takeTime on a field the race clock does not declare',
    command: buildCreateEnduroFinishCommand({
      ...buildEnduroClockFields('checkered'),
      momentOfTheFinish: { kind: 'takeTime' },
    }),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "momentOfTheFinish" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A graphic without a data schema marks no field at all, so it accepts no takeTime.
  {
    name: 'refuses takeTime on a field of the lower third, which has no data schema',
    command: buildCreatePodiumTeamCommand({
      ...lowerThirdFieldsOfTeam17,
      shownSinceMs: { kind: 'takeTime' },
    }),
    expectedMessage:
      'O gráfico "team-lower-third" não aceita que o servidor preencha o campo "shownSinceMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
];

describe('createItem with a takeTime value on a field that is not a moment', () => {
  it.each(refusedCreateScenarios)('$name', ({ command, expectedMessage }) => {
    // Arrange: a race day with one item, the race clock registered with its schema, and
    // a deep copy of the slices for comparison.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildEnduroStartItem(0)],
    });
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: try to create the item of this scenario.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: refused with the code and pt-BR message the take gives, and nothing changed.
    expect(outcome, 'the create must be refused, naming the graphic and the field').toEqual({
      status: 'refused',
      error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
    });
    expect(slicesBefore, 'a refused create must leave the slices as they were').toEqual(
      copyOfSlicesBefore,
    );
  });
});
