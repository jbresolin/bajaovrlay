/**
 * Finding the fields of a clock in any graphic's manifest (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" shows, in the time field of a clock on air, the time the screen
 *   shows right now. The control page holds no code for any one graphic, so it cannot
 *   know the race clock's field names. Instead a manifest says two things: that its
 *   updates run through the rule `carryClockForward`, and which of its properties play
 *   the four parts of a clock, each marked with a `v_baja.role`. findClockFieldKeysOfGraphic
 *   reads that and answers the four keys, or "this is not a clock I can follow".
 *
 * What these tests prove:
 *   - A graphic that names the rule and marks all four parts is found, whatever its
 *     keys are called (the example is a pit-stop countdown with keys in Portuguese).
 *   - It is not found when the rule is missing or is another rule, when the graphic has
 *     no data schema, when one part is not marked, when a part is marked on the wrong
 *     kind of field, or when two fields claim the same part. The form then behaves as
 *     for any other graphic.
 *   - The race clock, as the panel's fake server lists it, is found with its four keys.
 *
 * What these tests deliberately do not cover:
 *   - Reading the data on air through those keys and working out the time:
 *     timeOnScreenOfClockOnAir.test.ts.
 *   - The server's side of the same contract (which fields the rule writes):
 *     apps/server/src/core/store/updateRules has its own tests.
 */
import { describe, expect, it } from 'vitest';

import { describeSchemaFormFromDataSchema } from '@/features/schemaForm';
import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import { findClockFieldKeysOfGraphic } from './clockFieldsOfGraphic';

/**
 * The four clock properties of a pit-stop countdown, as its manifest would write them:
 * a graphic that is not the race clock and shares no key with it.
 */
function buildPitStopCountdownProperties(): Record<string, Record<string, unknown>> {
  return {
    equipe: { type: 'string', title: 'Equipe' },
    sentido: {
      type: 'string',
      title: 'Sentido da contagem',
      enum: ['elapsed', 'remaining'],
      v_baja: { role: 'clockMode' },
    },
    tempoMs: {
      type: 'integer',
      title: 'Tempo de box',
      v_baja: { unit: 'ms', role: 'clockTime' },
    },
    momentoDaLeituraMs: {
      type: 'integer',
      title: 'Momento da leitura',
      v_baja: { role: 'wallClock' },
    },
    contando: { type: 'boolean', title: 'Contando', v_baja: { role: 'clockRunning' } },
  };
}

/** A data schema with these properties, as a manifest carries it. */
function buildDataSchemaWithProperties(properties: Record<string, unknown>) {
  return { type: 'object', properties };
}

const keysOfThePitStopCountdown = {
  timeFieldKey: 'tempoMs',
  referenceMomentFieldKey: 'momentoDaLeituraMs',
  runningFieldKey: 'contando',
  clockModeFieldKey: 'sentido',
};

describe('findClockFieldKeysOfGraphic', () => {
  const pitStopCountdown = buildPitStopCountdownProperties();

  const manifestsAsGraphicAuthorsWriteThem = [
    // The contract kept in full: the rule is named and all four parts are marked.
    {
      name: 'finds the four keys of a graphic that names the rule and marks every part',
      nameOfTheUpdateRule: 'carryClockForward',
      dataSchema: buildDataSchemaWithProperties(pitStopCountdown),
      expectedKeys: keysOfThePitStopCountdown,
    },
    // Roles alone are not enough: without the rule the server does not carry the clock
    // forward, so the form must not pretend the time field is a live clock.
    {
      name: 'finds nothing when the manifest names no update rule',
      nameOfTheUpdateRule: undefined,
      dataSchema: buildDataSchemaWithProperties(pitStopCountdown),
      expectedKeys: undefined,
    },
    // Another rule may one day reuse a role for something else.
    {
      name: 'finds nothing when the manifest names another rule',
      nameOfTheUpdateRule: 'keepScoreOnUpdate',
      dataSchema: buildDataSchemaWithProperties(pitStopCountdown),
      expectedKeys: undefined,
    },
    // OGraf allows a graphic without data; a rule named on one has no fields to find.
    {
      name: 'finds nothing when the graphic has no data schema',
      nameOfTheUpdateRule: 'carryClockForward',
      dataSchema: undefined,
      expectedKeys: undefined,
    },
    // The race clock's manifest before the roles were added: the switch is not marked.
    {
      name: 'finds nothing when one part, the running switch, is not marked',
      nameOfTheUpdateRule: 'carryClockForward',
      dataSchema: buildDataSchemaWithProperties({
        ...pitStopCountdown,
        contando: { type: 'boolean', title: 'Contando' },
      }),
      expectedKeys: undefined,
    },
    // A time without `unit: ms` is typed as a bare number, not as mm:ss: the form could
    // not show "27:34" in it.
    {
      name: 'finds nothing when the time is marked on a field that is not typed as mm:ss',
      nameOfTheUpdateRule: 'carryClockForward',
      dataSchema: buildDataSchemaWithProperties({
        ...pitStopCountdown,
        tempoMs: { type: 'integer', title: 'Tempo de box', v_baja: { role: 'clockTime' } },
      }),
      expectedKeys: undefined,
    },
    // A copied property that kept its role: guessing which of the two is the clock's
    // time could show the wrong one.
    {
      name: 'finds nothing when two fields claim to be the time',
      nameOfTheUpdateRule: 'carryClockForward',
      dataSchema: buildDataSchemaWithProperties({
        ...pitStopCountdown,
        tempoDaVoltaMs: {
          type: 'integer',
          title: 'Tempo da volta',
          v_baja: { unit: 'ms', role: 'clockTime' },
        },
      }),
      expectedKeys: undefined,
    },
  ];

  it.each(manifestsAsGraphicAuthorsWriteThem)(
    '$name',
    ({ nameOfTheUpdateRule, dataSchema, expectedKeys }) => {
      // Arrange: the manifest's data schema, read the way the form reads it.
      const description = describeSchemaFormFromDataSchema(dataSchema);

      // Act: look for the clock's fields.
      const clockFieldKeys = findClockFieldKeysOfGraphic(nameOfTheUpdateRule, description);

      // Assert: the four keys, or nothing at all (never some of them).
      expect(
        clockFieldKeys,
        'the clock’s keys must be found only when the rule is named and each part is marked once, on the right kind of field',
      ).toEqual(expectedKeys);
    },
  );

  it('finds the race clock’s four keys in the graphic the panel tests put on the fake server', () => {
    // Arrange: the race clock as the fake server of the panel tests lists it.
    const raceClockGraphic = buildRaceClockGraphic();
    const description = describeSchemaFormFromDataSchema(raceClockGraphic.manifest.schema);

    // Act: look for the clock's fields.
    const clockFieldKeys = findClockFieldKeysOfGraphic(
      raceClockGraphic.manifest.v_baja?.updateRule,
      description,
    );

    // Assert: the race clock is a clock the form can follow.
    expect(clockFieldKeys, 'the race clock must be found by its rule and roles').toEqual({
      timeFieldKey: 'referenceTimeMs',
      referenceMomentFieldKey: 'referenceWallClockMs',
      runningFieldKey: 'running',
      clockModeFieldKey: 'clockMode',
    });
  });
});
