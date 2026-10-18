/**
 * takeItem and takeNext refusing a take-time field that is not a moment (apps/server)
 *
 * What this module is for:
 *   An item field may say `{ kind: 'takeTime' }`: "the server fills this with the moment
 *   the item goes on air". The server writes its own moment only into a field the
 *   graphic's schema declares as a whole number marked `v_baja.role: "wallClock"`. That
 *   rule holds for an update on air (`takeTimeFieldKeys`) and must hold for an item as
 *   well: otherwise an item could have today's date in milliseconds written into the
 *   race clock's reference TIME, and the clock on air would show about fifty-six years.
 *   takeItem hands the keys of its take-time fields to the internal take step
 *   putGraphicOnOutput every take and preview ends in, so one check covers them all.
 *
 * What these tests prove:
 *   - An item whose take-time field is a whole number without the wall-clock mark, a
 *     field the graphic does not have, or any field of a graphic with no data schema is
 *     refused at the take, with a pt-BR message naming the graphic and the field.
 *   - A refused take changes nothing: what was on air stays, and so does the cursor.
 *   - takeNext, the Space key, is refused exactly as takeItem is.
 *
 * What these tests deliberately do not cover:
 *   - A take-time field on the race clock's reference moment, which is accepted;
 *     takeItemTakeTime.test.ts covers it.
 *   - The same check on the take step itself; putGraphicOnOutputClearedAndStampedFields.test.ts.
 *   - Saving such an item: createItem and updateItemFields refuse it too
 *     (createItemTakeTimeField.test.ts, updateItemFieldsTakeTimeField.test.ts). The take
 *     still checks, because an item may have been saved before that rule or before its
 *     graphic's manifest changed. graphicSchemaProperties.test.ts covers how the schema
 *     is read.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildPodiumTeamItem,
  buildRaceDaySlicesWithRundown,
  buildTeam42LowerThirdTakenByHand,
  contextOfTheRundownCommand,
  mainSessionRundownId,
} from './rundownSlices.testSupport.js';

/** Builds "Largada do enduro" with the take-time mark on the reference time, by mistake. */
function buildEnduroStartItemStampingItsReferenceTime(): Item {
  const startItem = buildEnduroStartItem(0);
  return {
    ...startItem,
    fields: {
      ...startItem.fields,
      referenceTimeMs: { kind: 'takeTime' },
      referenceWallClockMs: { kind: 'literal', value: 0 },
    },
  };
}

/** Builds "Largada do enduro" with a take-time field the race clock does not have. */
function buildEnduroStartItemStampingAFieldTheClockLacks(): Item {
  const startItem = buildEnduroStartItem(0);
  return { ...startItem, fields: { ...startItem.fields, momentOfTheStart: { kind: 'takeTime' } } };
}

/** Builds "Pódio — Baja UFPR" with a take-time field; the lower third has no data schema. */
function buildPodiumTeamItemStampingAField(): Item {
  const podiumItem = buildPodiumTeamItem(0);
  return { ...podiumItem, fields: { ...podiumItem.fields, shownSinceMs: { kind: 'takeTime' } } };
}

/**
 * Builds race day slices holding only the given item, with the cursor of its rundown on
 * it, the race clock registered with its real data schema, the team lower third
 * registered without one, and team 42's lower third already on air.
 */
function buildRaceDayWithItemUnderTheCursor(item: Item): SlicesChangedByCommands {
  const isItemOfTheMainSession =
    item.home.kind === 'rundown' && item.home.rundownId === mainSessionRundownId;
  const cursorOfTheMainSession = isItemOfTheMainSession ? item.id : null;
  const cursorOfThePodiumCeremony = isItemOfTheMainSession ? null : item.id;
  const raceDaySlices = buildRaceDaySlicesWithRundown({
    rundowns: [
      buildMainSessionRundown(cursorOfTheMainSession),
      buildPodiumRundown(cursorOfThePodiumCeremony),
    ],
    items: [item],
    instances: [buildTeam42LowerThirdTakenByHand()],
  });
  const raceClockWithItsDataSchema: Graphic = {
    id: 'race-clock',
    manifest: raceClockManifestForTests,
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
  const graphicsOtherThanTheRaceClock = raceDaySlices.graphics.filter(
    (graphic) => graphic.id !== 'race-clock',
  );
  return {
    ...raceDaySlices,
    graphics: [raceClockWithItsDataSchema, ...graphicsOtherThanTheRaceClock],
  };
}

const itemsWhoseTakeTimeFieldIsNotAMoment: Array<{
  name: string;
  item: Item;
  expectedMessage: string;
}> = [
  // The case the check exists for: the reference TIME is a whole number but a duration.
  // Stamped with a date in milliseconds it would pass the schema and show about 56 years.
  {
    name: "the race clock's reference time, a whole number that is not a moment",
    item: buildEnduroStartItemStampingItsReferenceTime(),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A field the schema does not declare: nothing says it is a moment.
  {
    name: 'a field the race clock does not have',
    item: buildEnduroStartItemStampingAFieldTheClockLacks(),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "momentOfTheStart" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A graphic without a data schema marks no field at all, so it accepts no stamp.
  {
    name: 'a field of the team lower third, which has no data schema',
    item: buildPodiumTeamItemStampingAField(),
    expectedMessage:
      'O gráfico "team-lower-third" não aceita que o servidor preencha o campo "shownSinceMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
];

describe('takeItem of an item whose take-time field is not a moment', () => {
  it.each(itemsWhoseTakeTimeFieldIsNotAMoment)(
    'refuses the take when the field is $name',
    ({ item, expectedMessage }) => {
      // Arrange: the item of the row under the cursor of its rundown, team 42's lower
      // third on air, and a deep copy of the slices for comparison.
      const slicesBefore = buildRaceDayWithItemUnderTheCursor(item);
      const copyOfSlicesBefore = structuredClone(slicesBefore);

      // Act: fire the item with its "Disparar" button.
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'takeItem', itemId: item.id },
        contextOfTheRundownCommand,
      );

      // Assert: refused in pt-BR, naming the graphic and the field; and nothing changed,
      // so the lower third is still on air and the cursor is still on the item.
      expect(outcome, 'the take must be refused, naming the field that is not a moment').toEqual({
        status: 'refused',
        error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
      });
      expect(slicesBefore, 'a refused take must leave the slices as they were').toEqual(
        copyOfSlicesBefore,
      );
    },
  );
});

describe('takeNext of an item whose take-time field is not a moment', () => {
  it('is refused exactly as takeItem is', () => {
    // Arrange: the start item that marks its reference time as take-time, under the cursor.
    const slicesBefore = buildRaceDayWithItemUnderTheCursor(
      buildEnduroStartItemStampingItsReferenceTime(),
    );

    // Act: press Space.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeNext', rundownId: mainSessionRundownId },
      contextOfTheRundownCommand,
    );

    // Assert: the same refusal the "Disparar" button gets.
    expect(outcome, 'Space must be refused as the Disparar button is').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
      },
    });
  });
});
