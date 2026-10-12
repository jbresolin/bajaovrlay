/**
 * updateItemFields and the fields that may say "the moment of the take" (apps/server)
 *
 * What this module is for:
 *   An item field may say `{ kind: 'takeTime' }`: "the server fills this with the moment
 *   the item goes on air". The server writes its own moment only into a field the
 *   graphic's schema declares as a whole number marked `v_baja.role: "wallClock"`.
 *   updateItemFields applies that rule to every takeTime value the command carries, with
 *   the same refusal as at the take. Field values the command does not carry are not
 *   looked at: an item saved before this rule, or before its graphic's manifest changed,
 *   can still have its label or another field edited.
 *
 * What these tests prove:
 *   - Adding takeTime on the race clock's reference moment is accepted.
 *   - A stored takeTime on a wrong field is left alone when the command does not carry
 *     that key, whether the command changes the label or another field.
 *   - A typed value is accepted on any field.
 *   - A takeTime value carried by the command on a whole number without the wall-clock
 *     mark, on an undeclared field, on a field of a graphic with no data schema, or
 *     re-sent for a wrong field that already holds it, is refused; nothing changes.
 *   - When the item's graphic is no longer registered, an update carrying a takeTime
 *     value is refused with GRAPHIC_NOT_FOUND, and one carrying none is accepted as before.
 *
 * What these tests deliberately do not cover:
 *   - Everything else updateItemFields does; updateItemFields.test.ts.
 *   - The same check at the take; takeItemTakeTimeOnWrongField.test.ts.
 */
import type { Command, Item, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroClockFields,
  buildEnduroStartItem,
  buildPodiumTeamItem,
  buildRaceDaySlicesWithTheRaceClockSchema,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/**
 * Builds "Largada do enduro" as it could have been saved before this rule existed: its
 * reference TIME (a duration, not a moment) says takeTime.
 */
function buildEnduroStartItemSavedWithTakeTimeOnItsReferenceTime(): Item {
  const startItem = buildEnduroStartItem(0);
  return {
    ...startItem,
    fields: { ...startItem.fields, referenceTimeMs: { kind: 'takeTime' } },
  };
}

/** Builds an update of the fields of "Largada do enduro". */
function buildUpdateOfTheStartItemFields(fields: ItemFields): Command {
  return { type: 'updateItemFields', itemId: 'item-largada-do-enduro', fields };
}

/** Builds an update of the fields of "Pódio — Baja UFPR", a lower third item. */
function buildUpdateOfThePodiumItemFields(fields: ItemFields): Command {
  return { type: 'updateItemFields', itemId: 'item-podio-baja-ufpr', fields };
}

/** The same slices with the race clock taken out of the registered graphics. */
function removeTheRaceClockFromTheGraphics(
  slices: SlicesChangedByCommands,
): SlicesChangedByCommands {
  const graphicsWithoutTheRaceClock = slices.graphics.filter(
    (graphic) => graphic.id !== 'race-clock',
  );
  return { ...slices, graphics: graphicsWithoutTheRaceClock };
}

const acceptedUpdateScenarios: Array<{
  name: string;
  itemBefore: Item;
  command: Command;
  expectedFieldsAfter: ItemFields;
}> = [
  // The usual edit: the operator chooses "Momento da entrada no ar" for the reference moment.
  {
    name: "accepts adding takeTime on the race clock's reference moment",
    itemBefore: buildEnduroStartItem(0),
    command: buildUpdateOfTheStartItemFields({ referenceWallClockMs: { kind: 'takeTime' } }),
    expectedFieldsAfter: {
      ...buildEnduroClockFields('green'),
      referenceWallClockMs: { kind: 'takeTime' },
    },
  },
  // An item saved before the rule must still be renamed: the command carries no field.
  {
    name: 'leaves a stored takeTime on a wrong field alone when only the label changes',
    itemBefore: buildEnduroStartItemSavedWithTakeTimeOnItsReferenceTime(),
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      label: 'Largada — bandeira verde',
    },
    expectedFieldsAfter: {
      ...buildEnduroClockFields('green'),
      referenceTimeMs: { kind: 'takeTime' },
    },
  },
  // Only the keys the command carries are judged: another field can change beside it.
  {
    name: 'leaves a stored takeTime on a wrong field alone when another field changes',
    itemBefore: buildEnduroStartItemSavedWithTakeTimeOnItsReferenceTime(),
    command: buildUpdateOfTheStartItemFields({
      sessionName: { kind: 'literal', value: 'Enduro — 2ª bateria' },
    }),
    expectedFieldsAfter: {
      ...buildEnduroClockFields('green'),
      referenceTimeMs: { kind: 'takeTime' },
      sessionName: { kind: 'literal', value: 'Enduro — 2ª bateria' },
    },
  },
  // How such an item is repaired: a typed value replaces the wrong takeTime.
  {
    name: 'accepts a typed value that replaces a stored takeTime on a wrong field',
    itemBefore: buildEnduroStartItemSavedWithTakeTimeOnItsReferenceTime(),
    command: buildUpdateOfTheStartItemFields({
      referenceTimeMs: { kind: 'literal', value: 3_900_000 },
    }),
    expectedFieldsAfter: buildEnduroClockFields('green'),
  },
];

describe('updateItemFields with fields the server may store', () => {
  it.each(acceptedUpdateScenarios)('$name', ({ itemBefore, command, expectedFieldsAfter }) => {
    // Arrange: a race day holding the item of this scenario, and the race clock
    // registered with its schema.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({ items: [itemBefore] });

    // Act: send the update.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: applied, and the item's fields are the merge the scenario expects.
    expect(outcome.status, 'the update must be applied').toBe('applied');
    const itemAfter = outcome.status === 'applied' ? outcome.slices.items[0] : undefined;
    expect(itemAfter?.fields, 'the item must hold exactly these fields').toEqual(
      expectedFieldsAfter,
    );
  });
});

const refusedUpdateScenarios: Array<{
  name: string;
  itemBefore: Item;
  command: Command;
  expectedMessage: string;
}> = [
  // The case the check exists for: a duration stamped with a date shows about 56 years.
  {
    name: "refuses adding takeTime on the race clock's reference time, a whole number that is not a moment",
    itemBefore: buildEnduroStartItem(0),
    command: buildUpdateOfTheStartItemFields({ referenceTimeMs: { kind: 'takeTime' } }),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A field the schema does not declare: nothing says it is a moment.
  {
    name: 'refuses adding takeTime on a field the race clock does not declare',
    itemBefore: buildEnduroStartItem(0),
    command: buildUpdateOfTheStartItemFields({ momentOfTheStart: { kind: 'takeTime' } }),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "momentOfTheStart" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A graphic without a data schema marks no field at all, so it accepts no takeTime.
  {
    name: 'refuses adding takeTime on a field of the lower third, which has no data schema',
    itemBefore: buildPodiumTeamItem(0),
    command: buildUpdateOfThePodiumItemFields({ shownSinceMs: { kind: 'takeTime' } }),
    expectedMessage:
      'O gráfico "team-lower-third" não aceita que o servidor preencha o campo "shownSinceMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A script that writes the whole item back: a wrong takeTime it sends again is still
  // a wrong takeTime, even though the item already holds it, and it is told so.
  {
    name: 'refuses a takeTime re-sent for a wrong field that already holds it',
    itemBefore: buildEnduroStartItemSavedWithTakeTimeOnItsReferenceTime(),
    command: buildUpdateOfTheStartItemFields({ referenceTimeMs: { kind: 'takeTime' } }),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
];

describe('updateItemFields with a takeTime value on a field that is not a moment', () => {
  it.each(refusedUpdateScenarios)('$name', ({ itemBefore, command, expectedMessage }) => {
    // Arrange: a race day holding the item of this scenario, the race clock registered
    // with its schema, and a deep copy of the slices for comparison.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({ items: [itemBefore] });
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: send the update.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: refused with the code and pt-BR message the take gives, and nothing changed.
    expect(outcome, 'the update must be refused, naming the graphic and the field').toEqual({
      status: 'refused',
      error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
    });
    expect(slicesBefore, 'a refused update must leave the slices as they were').toEqual(
      copyOfSlicesBefore,
    );
  });
});

describe('updateItemFields of an item whose graphic is no longer registered', () => {
  it('refuses an update that carries a takeTime value, with GRAPHIC_NOT_FOUND', () => {
    // Arrange: "Largada do enduro" in the rundown, with the race clock's package removed
    // from the graphics folder, and a deep copy of the slices for comparison.
    const slicesBefore = removeTheRaceClockFromTheGraphics(
      buildRaceDaySlicesWithTheRaceClockSchema({ items: [buildEnduroStartItem(0)] }),
    );
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: choose "the moment of the take" for the reference moment.
    const outcome = reduceCommand(
      slicesBefore,
      buildUpdateOfTheStartItemFields({ referenceWallClockMs: { kind: 'takeTime' } }),
      contextOfTheRundownCommand,
    );

    // Assert: refused, because no manifest is there to say the field is a moment; and
    // nothing changed.
    expect(outcome, 'a takeTime for an unregistered graphic must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'GRAPHIC_NOT_FOUND',
        message: 'O gráfico "race-clock" não está registrado.',
      },
    });
    expect(slicesBefore, 'a refused update must leave the slices as they were').toEqual(
      copyOfSlicesBefore,
    );
  });

  it('still accepts an update that carries no takeTime value', () => {
    // Arrange: the same rundown, the race clock not registered.
    const slicesBefore = removeTheRaceClockFromTheGraphics(
      buildRaceDaySlicesWithTheRaceClockSchema({ items: [buildEnduroStartItem(0)] }),
    );

    // Act: rename the item and type another session name.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateItemFields',
        itemId: 'item-largada-do-enduro',
        label: 'Largada — bandeira verde',
        fields: { sessionName: { kind: 'literal', value: 'Enduro — 2ª bateria' } },
      },
      contextOfTheRundownCommand,
    );

    // Assert: applied as it always was; the graphic is not needed to judge typed values.
    expect(outcome.status, 'typed values need no manifest, so the update is applied').toBe(
      'applied',
    );
    const itemAfter = outcome.status === 'applied' ? outcome.slices.items[0] : undefined;
    expect(
      [itemAfter?.label, itemAfter?.fields.sessionName],
      'the item must hold the new label and the new session name',
    ).toEqual(['Largada — bandeira verde', { kind: 'literal', value: 'Enduro — 2ª bateria' }]);
  });
});
