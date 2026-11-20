/**
 * The server's data check with the optional flag and the strip's laps and gaps
 * (apps/server, BAJAOVRLAY-81)
 *
 * What this module is for:
 *   Before a take or an update reaches the air, the server checks the data against the
 *   graphic's manifest schema (graphicDataValidation.ts). BAJAOVRLAY-81 made the flag
 *   ("Bandeira") optional on the lower strip, the race clock and the message ticker, and
 *   gave the strip two choices of what each car shows (its laps and its gap to the
 *   leader). These tests run the real manifests, as the packages ship them, through that
 *   check.
 *
 * What these tests prove:
 *   - An item saved before BAJAOVRLAY-81 (flag set, no laps or gap choice) still passes,
 *     on all three graphics.
 *   - The same data with the flag left out passes, on all three.
 *   - The strip bound to the positions' "Lista completa", with the real sample of the
 *     enduro (laps, gaps in ms and in laps, intervals, lap times, status), the laps on and
 *     each gap display, passes.
 *   - A list with a bad gap (0 laps behind, a fractional time) is still taken: the strip
 *     only blanks that cell, so the server must not refuse the list for it.
 *   - A gap display the strip does not know is refused, naming the field.
 *
 * What these tests deliberately do not cover:
 *   - The graphics drawing the data; each package's own tests.
 *   - How a binding fills the list; the shared binding tests.
 */
import { readFileSync } from 'node:fs';

import type { Graphic, OGrafManifest } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { findProblemInGraphicData } from './graphicDataValidation.js';

/** Reads a manifest from the graphics packages, as the package ships it. */
function readManifestOfGraphicPackage(packageName: string): OGrafManifest {
  const manifestAddress = new URL(
    `../../../../../packages/graphics/${packageName}/${packageName}.ograf.json`,
    import.meta.url,
  );
  return JSON.parse(readFileSync(manifestAddress, 'utf8')) as OGrafManifest;
}

/** Builds a graphic as the graphics slice holds it, from its real manifest. */
function buildGraphicFromItsPackage(packageName: string): Graphic {
  return {
    id: packageName,
    manifest: readManifestOfGraphicPackage(packageName),
    defaultLayerId: 'ticker',
    category: 'other',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The enduro's positions at lap 34, as the positions source sends them (the shared sample). */
function readEnduroPositionsAtLapThirtyFour(): Record<string, unknown>[] {
  const sampleAddress = new URL(
    '../../../../../packages/shared/src/dataShapes/samples/positions.enduro-lap-34.json',
    import.meta.url,
  );
  const sample = JSON.parse(readFileSync(sampleAddress, 'utf8')) as {
    entries: Record<string, unknown>[];
  };
  return sample.entries;
}

/** The four clock fields every clock graphic needs: 1:05:00 of the enduro, held. */
const enduroClockFields = {
  clockMode: 'elapsed',
  referenceTimeMs: 3_900_000,
  referenceWallClockMs: Date.parse('2026-10-09T13:00:00.000Z'),
  running: false,
};

/** Data as an item saved before BAJAOVRLAY-81 sends it, per graphic: the flag is set. */
const dataSavedBeforeTheChange: Record<string, Record<string, unknown>> = {
  'lower-strip': {
    entries: [{ position: 1, carNumber: 51, schoolName: 'FAHOR' }],
    state: 'green',
    ...enduroClockFields,
    showClockBlock: true,
  },
  'race-clock': {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    ...enduroClockFields,
    lapsCompletedByLeader: 12,
  },
  'message-ticker': {
    label: 'AVISO',
    messages: ['Largada do enduro às 10h00'],
    state: 'green',
    ...enduroClockFields,
    showClockBlock: true,
  },
};

describe('the three graphics with a flag', () => {
  it.each(['lower-strip', 'race-clock', 'message-ticker'])(
    'accepts %s data saved before the flag became optional',
    (packageName) => {
      // Arrange: the graphic from its real manifest, and data with the flag set.
      const graphic = buildGraphicFromItsPackage(packageName);
      const data = dataSavedBeforeTheChange[packageName] ?? {};

      // Act: check it as a take would.
      const problem = findProblemInGraphicData(graphic, data);

      // Assert: no problem; the items of before keep working.
      expect(problem, 'data saved before must still pass').toBeUndefined();
    },
  );

  it.each(['lower-strip', 'race-clock', 'message-ticker'])(
    'accepts %s data with the flag left out',
    (packageName) => {
      // Arrange: the same data with "Bandeira" cleared, so no `state` is sent.
      const graphic = buildGraphicFromItsPackage(packageName);
      const { state: flagLeftOut, ...dataWithoutFlag } =
        dataSavedBeforeTheChange[packageName] ?? {};

      // Act: check it as a take would.
      const problem = findProblemInGraphicData(graphic, dataWithoutFlag);

      // Assert: the flag is optional, so nothing is missing.
      expect(flagLeftOut, 'the data we started from had a flag').toBe('green');
      expect(problem, 'data without a flag must pass').toBeUndefined();
    },
  );
});

describe('the lower strip bound to the positions’ "Lista completa"', () => {
  it.each(['none', 'laps', 'lapsAndTime', 'time'])(
    'accepts the real enduro sample with the laps on and the gap as "%s"',
    (gapDisplay) => {
      // Arrange: the strip, and the whole positions list with every field it carries.
      const graphic = buildGraphicFromItsPackage('lower-strip');
      const data = {
        entries: readEnduroPositionsAtLapThirtyFour(),
        ...enduroClockFields,
        showLaps: true,
        gapDisplay,
      };

      // Act: check it as a take would.
      const problem = findProblemInGraphicData(graphic, data);

      // Assert: the canonical laps and gaps fit the strip's list as they come.
      expect(problem, 'the positions list must fit the strip as it comes').toBeUndefined();
    },
  );

  it('accepts a list whose gaps are outside the positions shape’s limits', () => {
    // Arrange: the strip, and two cars with gaps no positions source should send.
    const graphic = buildGraphicFromItsPackage('lower-strip');
    const data = {
      ...dataSavedBeforeTheChange['lower-strip'],
      entries: [
        { position: 1, carNumber: 51, schoolName: 'FAHOR', laps: 6 },
        { position: 2, carNumber: 10, schoolName: 'UFSJ', laps: 6, gapToLeaderLaps: 0 },
        { position: 3, carNumber: 1, schoolName: 'FEI', laps: 6, gapToLeaderMs: 1500.5 },
      ],
      gapDisplay: 'lapsAndTime',
    };

    // Act: check it as an update would.
    const problem = findProblemInGraphicData(graphic, data);

    // Assert: taken, as before these cells existed; the strip blanks the bad cells.
    expect(problem, 'a bad gap must not refuse the whole list').toBeUndefined();
  });

  it('refuses a gap display the strip does not know, naming the field', () => {
    // Arrange: the strip, with a gap display misspelt by a hand-written request.
    const graphic = buildGraphicFromItsPackage('lower-strip');
    const data = { ...dataSavedBeforeTheChange['lower-strip'], gapDisplay: 'intervalo' };

    // Act: check it.
    const problem = findProblemInGraphicData(graphic, data);

    // Assert: refused, and the field is named.
    expect(problem, 'an unknown gap display must be refused').toEqual({
      kind: 'invalidValue',
      fieldPath: 'gapDisplay',
    });
  });
});
