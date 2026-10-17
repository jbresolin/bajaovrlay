/**
 * The fake server's handling of graphic data (apps/control, test support)
 *
 * What this module is for:
 *   The panel tests talk to a fake server. It is only worth anything if it answers as the
 *   real one does, so graphicDataAsTheServerPreparesIt.testSupport.ts copies the real
 *   server's steps for the data of an update ("Atualizar", the one command "Edição
 *   rápida" sends since BAJAOVRLAY-37). These tests pin the two steps where a dishonest
 *   fake would let a wrong control page pass.
 *
 * What these tests prove:
 *   - The fake stamps the moment of the command only into a field the graphic's schema
 *     declares as an integer with `v_baja.role: "wallClock"`. Any other field named for
 *     stamping is refused in the real server's words, and a graphic without a schema
 *     accepts no stamp at all.
 *   - For an update of the race clock the fake carries the clock forward as the real
 *     server's `carryClockForward` rule does: a stopped clock keeps the time the screen
 *     showed, a flag change leaves the clock's fields alone, a stamp asked for by the
 *     sender is obeyed as it came, and a clock turned around keeps the whole second on screen.
 *
 * What these tests deliberately do not cover:
 *   - The real server. Its own tests are the proof of these rules
 *     (apps/server: graphicSchemaProperties.test.ts, carryClockForward.test.ts,
 *     updateInstanceDataCarriesTheClock.test.ts); this file only keeps the copy from
 *     drifting where the panel tests lean on it.
 *   - The check of the result against the graphic's schema, which the fake leaves out.
 */
import { describe, expect, it } from 'vitest';

import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import { prepareDataOfUpdateAsTheServerDoes } from './graphicDataAsTheServerPreparesIt.testSupport';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45
// and the command arrives at 10:00, fifteen minutes later.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

/** The first heat on air: green flag, running from 12:34 (754 000 ms) since 9:45. */
function buildFirstHeatDataOnAir(): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência — Bateria 1',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 754_000,
    referenceWallClockMs: Date.parse(quarterToTen),
    running: true,
  };
}

describe('the fake server stamping the moment of a command', () => {
  it('writes the moment of the update into the race clock field its schema marks as a moment', () => {
    // Arrange: the first heat on air, and an update that asks the server for a new moment.
    const raceClock = buildRaceClockGraphic();

    // Act: the fake server prepares the data of that update, received at 10:00.
    const outcome = prepareDataOfUpdateAsTheServerDoes(raceClock, buildFirstHeatDataOnAir(), {
      data: {},
      takeTimeFieldKeys: ['referenceWallClockMs'],
      momentOfTheCommand: tenOClock,
    });

    // Assert: accepted, with 10:00 in milliseconds as the reference moment.
    expect(outcome, 'a wall-clock field must be stamped with the moment of the update').toEqual({
      wasAccepted: true,
      dataLeftOnAir: {
        ...buildFirstHeatDataOnAir(),
        referenceWallClockMs: Date.parse(tenOClock),
      },
    });
  });

  const stampsTheRealServerRefuses: Array<{
    name: string;
    graphicId: string;
    fieldKey: string;
  }> = [
    // A whole number, but a duration and not a moment: no `v_baja.role: "wallClock"`.
    {
      name: "the race clock's reference time, an integer that is not a moment",
      graphicId: 'race-clock',
      fieldKey: 'referenceTimeMs',
    },
    // A field the schema does not declare at all.
    {
      name: 'a field the race clock does not have',
      graphicId: 'race-clock',
      fieldKey: 'momentOfTheStart',
    },
    // A moment written as text (date-time), which the server cannot fill with a number.
    {
      name: "the lower third's interview time, which is a text and not an integer",
      graphicId: 'lower-third-fixture',
      fieldKey: 'horario',
    },
  ];

  it.each(stampsTheRealServerRefuses)(
    'refuses an update that asks for a stamp in $name',
    ({ graphicId, fieldKey }) => {
      // Arrange: the graphic of the row, and a command that names the field for stamping.
      const graphicsListed = [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()];
      const graphic = graphicsListed.find((graphicListed) => graphicListed.id === graphicId);
      if (graphic === undefined) {
        throw new Error(`no graphic "${graphicId}" in this test`);
      }
      const commandAskingForTheStamp = {
        data: {},
        takeTimeFieldKeys: [fieldKey],
        momentOfTheCommand: tenOClock,
      };

      // Act: the fake server prepares the command as an update.
      const outcomeOfTheUpdate = prepareDataOfUpdateAsTheServerDoes(
        graphic,
        {},
        commandAskingForTheStamp,
      );

      // Assert: refused, in the words the real server uses.
      const refusalInTheServersWords = {
        wasAccepted: false,
        refusal: {
          code: 'INVALID_GRAPHIC_DATA',
          message: `O gráfico "${graphicId}" não aceita que o servidor preencha o campo "${fieldKey}" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").`,
        },
      };
      expect(
        outcomeOfTheUpdate,
        'the update must be refused as the real server refuses it',
      ).toEqual(refusalInTheServersWords);
    },
  );

  it('accepts no stamp for a graphic whose manifest has no data schema', () => {
    // Arrange: the race clock as a manifest without a schema would register it.
    const raceClock = buildRaceClockGraphic();
    const raceClockWithoutSchema = {
      ...raceClock,
      manifest: { ...raceClock.manifest, schema: undefined },
    };

    // Act: an update asks for the stamp the real race clock accepts.
    const outcome = prepareDataOfUpdateAsTheServerDoes(
      raceClockWithoutSchema,
      {},
      {
        data: {},
        takeTimeFieldKeys: ['referenceWallClockMs'],
        momentOfTheCommand: tenOClock,
      },
    );

    // Assert: refused. With no schema nothing says that field is a moment.
    expect(
      outcome.wasAccepted,
      'a graphic without a schema must accept no stamp, as on the real server',
    ).toBe(false);
  });
});

describe('the fake server carrying the race clock forward on an update', () => {
  const updatesOfTheFirstHeatAtTenOClock: Array<{
    name: string;
    data: Record<string, unknown>;
    takeTimeFieldKeys: string[];
    expectedClockFieldsOnAir: Record<string, unknown>;
  }> = [
    // The stop: 12:34 plus the fifteen minutes since 9:45 is 27:34 (1 654 000 ms), held.
    {
      name: 'stopping the clock keeps the 27:34 the screen was showing',
      data: { running: false },
      takeTimeFieldKeys: [],
      expectedClockFieldsOnAir: {
        clockMode: 'elapsed',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: Date.parse(tenOClock),
        running: false,
      },
    },
    // A typed time becomes true at the press, so the clock counts on from it.
    {
      name: 'a typed 20:00 counts from the press',
      data: { referenceTimeMs: 1_200_000 },
      takeTimeFieldKeys: [],
      expectedClockFieldsOnAir: {
        clockMode: 'elapsed',
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: Date.parse(tenOClock),
        running: true,
      },
    },
    // The everyday update: a flag change must not touch the clock at all.
    {
      name: 'a flag change leaves the clock fields as they are',
      data: { state: 'yellow' },
      takeTimeFieldKeys: [],
      expectedClockFieldsOnAir: {
        clockMode: 'elapsed',
        referenceTimeMs: 754_000,
        referenceWallClockMs: Date.parse(quarterToTen),
        running: true,
      },
    },
    // The sender chose the moment itself ("Momento da entrada no ar"): the rule adds
    // nothing, so the clock counts the 12:34 on air from the press.
    {
      name: 'a stamp the sender asked for is obeyed as it came',
      data: {},
      takeTimeFieldKeys: ['referenceWallClockMs'],
      expectedClockFieldsOnAir: {
        clockMode: 'elapsed',
        referenceTimeMs: 754_000,
        referenceWallClockMs: Date.parse(tenOClock),
        running: true,
      },
    },
  ];

  it.each(updatesOfTheFirstHeatAtTenOClock)(
    '$name',
    ({ data, takeTimeFieldKeys, expectedClockFieldsOnAir }) => {
      // Arrange: the first heat on air, running from 12:34 since 9:45.
      const dataOnAir = buildFirstHeatDataOnAir();

      // Act: the fake server prepares the update of the row, received at 10:00.
      const outcome = prepareDataOfUpdateAsTheServerDoes(buildRaceClockGraphic(), dataOnAir, {
        data,
        takeTimeFieldKeys,
        momentOfTheCommand: tenOClock,
      });

      // Assert: accepted, and the four clock fields are what the real server leaves on
      // air. The session name is untouched in every row.
      expect(outcome, 'the clock fields on air must be the ones the real rule writes').toEqual({
        wasAccepted: true,
        dataLeftOnAir: {
          ...dataOnAir,
          ...data,
          ...expectedClockFieldsOnAir,
        },
      });
    },
  );

  it('keeps the number on screen when the clock is turned around between two whole seconds', () => {
    // Arrange: the first heat on air, running from 12:34 since 9:45. Half a second after
    // 10:00 it is at 27:34.5, which a clock counting up shows as 27:34.
    const dataOnAir = buildFirstHeatDataOnAir();
    const halfASecondPastTen = '2026-10-10T13:00:00.500Z';

    // Act: the fake server prepares an update that only turns the clock into a countdown.
    const outcome = prepareDataOfUpdateAsTheServerDoes(buildRaceClockGraphic(), dataOnAir, {
      data: { clockMode: 'remaining' },
      takeTimeFieldKeys: [],
      momentOfTheCommand: halfASecondPastTen,
    });

    // Assert: the whole 27:34 (1 654 000 ms) is written, as the real rule does. With the
    // half second kept, a countdown would show 27:35 at the press.
    expect(outcome, 'a clock turned around must keep the whole second it showed').toEqual({
      wasAccepted: true,
      dataLeftOnAir: {
        ...dataOnAir,
        clockMode: 'remaining',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: Date.parse(halfASecondPastTen),
      },
    });
  });
});
