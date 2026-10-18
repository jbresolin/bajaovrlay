/**
 * The session shape speaks the race clock's language (packages/shared)
 *
 * What this module is for:
 *   The session shape's flag (`state`) and clock (`session.clock`) are meant to feed the
 *   race clock graphic with no transform: a binding copies them across as they are. That
 *   only works while the shape and the graphic's manifest agree on the flag values and
 *   the clock's field names.
 *
 * What these tests prove:
 *   - The session `state` values are exactly the race clock manifest's `state` enum, in
 *     the same order, read from the manifest file itself so the two cannot drift apart.
 *   - The session clock's field names are exactly the manifest fields the race clock
 *     marks as its clock (roles clockMode, clockTime, wallClock and clockRunning), and its
 *     `clockMode` values are the manifest's.
 *
 * What these tests deliberately do not cover:
 *   - Whether a binding really copies the values (BAJAOVRLAY-20 builds bindings).
 *   - The rest of the session shape; dataShapes.test.ts validates the samples.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SessionClockSchema, SessionStateSchema } from './sessionShape.js';

/** The parts of the race clock manifest these tests read. */
type RaceClockManifestProperties = Record<string, { enum?: string[]; v_baja?: { role?: string } }>;

/** Reads the race clock graphic's manifest from its package folder, as the server does. */
function readRaceClockManifestProperties(): RaceClockManifestProperties {
  const manifestUrl = new URL(
    '../../../graphics/race-clock/race-clock.ograf.json',
    import.meta.url,
  );
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8')) as {
    schema: { properties: RaceClockManifestProperties };
  };
  return manifest.schema.properties;
}

describe('the session shape and the race clock manifest', () => {
  it('offers exactly the flag values of the race clock, in the same order', () => {
    // Arrange: the race clock's own list of flags.
    const manifestProperties = readRaceClockManifestProperties();

    // Act: read the session shape's list of flags.
    const sessionFlagValues = SessionStateSchema.options;

    // Assert: the two lists are the same, so a flag feeds the clock as it is.
    expect(sessionFlagValues, 'the session flags must equal the race clock manifest enum').toEqual(
      manifestProperties.state?.enum,
    );
  });

  it('names its clock fields exactly as the race clock names its clock fields', () => {
    // Arrange: the manifest fields the race clock marks with a clock role.
    const manifestProperties = readRaceClockManifestProperties();
    const clockRoles = ['clockMode', 'clockTime', 'wallClock', 'clockRunning'];
    const manifestClockFieldNames = Object.keys(manifestProperties).filter((fieldName) =>
      clockRoles.includes(manifestProperties[fieldName]?.v_baja?.role ?? ''),
    );

    // Act: read the session clock's field names.
    const sessionClockFieldNames = Object.keys(SessionClockSchema.shape);

    // Assert: the same four names, so the whole clock is copied with no rename.
    expect(
      [...sessionClockFieldNames].sort(),
      'the session clock fields must be the race clock clock fields',
    ).toEqual([...manifestClockFieldNames].sort());
  });

  it('counts up or down with exactly the race clock modes', () => {
    // Arrange: the race clock's list of modes.
    const manifestProperties = readRaceClockManifestProperties();

    // Act: read the session clock's list of modes.
    const sessionClockModes = SessionClockSchema.shape.clockMode.options;

    // Assert: the same list.
    expect(sessionClockModes, 'the clock modes must equal the manifest enum').toEqual(
      manifestProperties.clockMode?.enum,
    );
  });
});
