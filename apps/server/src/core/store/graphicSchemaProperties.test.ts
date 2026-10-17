/**
 * Which fields of a graphic the server may stamp (apps/server)
 *
 * What this module is for:
 *   A take or an update may name fields in `takeTimeFieldKeys`, and the server writes
 *   the moment of the command into each. That is meant for one kind of field only: a
 *   wall-clock moment, such as the moment the race clock's reference time was true. The
 *   graphic's manifest says which fields are of that kind, by declaring them
 *   `type: "integer"` with `v_baja.role: "wallClock"`. The server refuses to stamp any
 *   other field, so a client cannot have a number written wherever it likes.
 *
 * What these tests prove:
 *   - The race clock's reference moment may be stamped, and no key is reported for it.
 *   - A field the schema does not declare, a field that is not a whole number, and a
 *     whole number without the wall-clock mark are each reported.
 *   - A graphic whose manifest has no data schema accepts no stamp at all.
 *   - Of several keys, the first one that may not be stamped is the one reported.
 *   - A name every JavaScript object answers to (`constructor`) is not mistaken for a
 *     declared field.
 *
 * What these tests deliberately do not cover:
 *   - The refusal a reducer builds from the reported key, and its pt-BR wording; the
 *     reducer tests (putGraphicOnOutputClearedAndStampedFields.test.ts,
 *     updateInstanceDataClearedAndStampedFields.test.ts) cover those.
 */
import type { Graphic } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from './builtGraphicsFolder.testSupport.js';
import { findTakeTimeFieldKeyGraphicCannotStamp } from './graphicSchemaProperties.js';

/** Builds the race clock as the graphics slice holds it, with its real data schema. */
function buildRaceClockGraphic(): Graphic {
  return {
    id: 'race-clock',
    manifest: raceClockManifestForTests,
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** Builds team 42's lower third graphic, whose manifest declares no data schema. */
function buildLowerThirdGraphicWithoutSchema(): Graphic {
  return {
    id: 'team-lower-third',
    manifest: { id: 'baja-team-lower-third', name: 'Tarja de equipe', main: 'tarja.js' },
    defaultLayerId: 'lower-third',
    category: 'lower-third',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

const stampScenarios: Array<{
  name: string;
  graphic: Graphic;
  takeTimeFieldKeys: string[];
  expectedKeyThatCannotBeStamped: string | undefined;
}> = [
  // The one field the convention exists for: a whole number marked as a wall clock.
  {
    name: 'reports nothing for the race clock reference moment',
    graphic: buildRaceClockGraphic(),
    takeTimeFieldKeys: ['referenceWallClockMs'],
    expectedKeyThatCannotBeStamped: undefined,
  },
  // No stamp asked for: the usual command, and the one takeItem always sends.
  {
    name: 'reports nothing when no field is named',
    graphic: buildRaceClockGraphic(),
    takeTimeFieldKeys: [],
    expectedKeyThatCannotBeStamped: undefined,
  },
  // A field the race clock does not have must not be written next to the real ones.
  {
    name: 'reports a field the schema does not declare',
    graphic: buildRaceClockGraphic(),
    takeTimeFieldKeys: ['horarioDaLargada'],
    expectedKeyThatCannotBeStamped: 'horarioDaLargada',
  },
  // The flag is one of six texts; a number of milliseconds does not belong there.
  {
    name: 'reports a field that is not a whole number',
    graphic: buildRaceClockGraphic(),
    takeTimeFieldKeys: ['state'],
    expectedKeyThatCannotBeStamped: 'state',
  },
  // The reference time is a whole number too, but a duration: stamping it would put
  // fifty-six years on the clock. Being a whole number is not enough.
  {
    name: 'reports a whole number that is not marked as a wall-clock moment',
    graphic: buildRaceClockGraphic(),
    takeTimeFieldKeys: ['referenceTimeMs'],
    expectedKeyThatCannotBeStamped: 'referenceTimeMs',
  },
  // Without a schema nothing says which field is a moment, so none may be stamped.
  {
    name: 'reports any field of a graphic whose manifest has no data schema',
    graphic: buildLowerThirdGraphicWithoutSchema(),
    takeTimeFieldKeys: ['shownSinceMs'],
    expectedKeyThatCannotBeStamped: 'shownSinceMs',
  },
  // One good key does not excuse a bad one sent with it.
  {
    name: 'reports the first bad field when a good one comes before it',
    graphic: buildRaceClockGraphic(),
    takeTimeFieldKeys: ['referenceWallClockMs', 'lapsCompletedByLeader'],
    expectedKeyThatCannotBeStamped: 'lapsCompletedByLeader',
  },
  // Every JavaScript object has a `constructor`; the schema did not declare one.
  {
    name: 'reports "constructor", which no schema declares',
    graphic: buildRaceClockGraphic(),
    takeTimeFieldKeys: ['constructor'],
    expectedKeyThatCannotBeStamped: 'constructor',
  },
];

describe('findTakeTimeFieldKeyGraphicCannotStamp', () => {
  it.each(stampScenarios)(
    '$name',
    ({ graphic, takeTimeFieldKeys, expectedKeyThatCannotBeStamped }) => {
      // Arrange: the graphic and the fields a command asks the server to stamp.
      const keysTheCommandNames = takeTimeFieldKeys;

      // Act: ask which of them the server may not stamp.
      const keyThatCannotBeStamped = findTakeTimeFieldKeyGraphicCannotStamp(
        graphic,
        keysTheCommandNames,
      );

      // Assert: the key the scenario expects, or none.
      expect(
        keyThatCannotBeStamped,
        'only a whole-number field marked wallClock in the schema may be stamped',
      ).toBe(expectedKeyThatCannotBeStamped);
    },
  );
});
