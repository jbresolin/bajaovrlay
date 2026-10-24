/**
 * What a field may read from a source (apps/control)
 *
 * What this module is for:
 *   The item editor's kind selector offers "Fonte" for a field only when some bindable
 *   path fits it, then lists only the paths that fit (directly, or through a binding
 *   transform), and for the path chosen only the transforms that make it fit. The field's
 *   type comes from the graphic's data schema (shared bindingFitsGraphicField.ts). The
 *   whole clock is offered apart, as "Relógio da fonte", on the time field of a graphic
 *   that marks the four clock roles.
 *
 * What these tests prove:
 *   - The race clock's flag lists the session flag and texts, never the running switch;
 *     its running switch lists only yes/no paths.
 *   - A text field lists the leader's last lap, which fits through "Tempo de volta como
 *     texto", and that transform alone is offered for it; the team name fits as it is.
 *   - A list field lists the three whole lists, and topN is offered on the positions.
 *   - An object field has nothing to read: "Fonte" is not offered.
 *   - The whole clock is offered on the race clock's time field and on no other.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the choices; the item editor's component tests.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { describe, expect, it } from 'vitest';

import {
  canFieldBeBoundToASource,
  canFieldTakeTheWholeClock,
  listBindingPathChoicesOfField,
} from './bindingChoices';

/** A positions tower: a title, the list of cars and a theme object. */
const towerDataSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Título' },
    entries: { type: 'array', title: 'Carros' },
    theme: { type: 'object', title: 'Tema' },
  },
};

describe('listBindingPathChoicesOfField', () => {
  it('lists the session flag for the race clock flag, and never the running switch', () => {
    // Arrange: the race clock's schema.
    const dataSchema = raceClockManifest.schema;

    // Act: list what its flag may read.
    const pathKeys = listBindingPathChoicesOfField(dataSchema, 'state').map(
      (choice) => choice.pathKey,
    );

    // Assert: the flag is there; a yes/no is not text.
    expect(pathKeys, 'the session flag must be offered').toContain('session:state');
    expect(pathKeys, 'a yes/no path must not be offered').not.toContain('session:clock.running');
  });

  it('lists only yes/no paths for the running switch', () => {
    // Arrange: the race clock's schema.
    const dataSchema = raceClockManifest.schema;

    // Act: list what its running switch may read.
    const pathKeys = listBindingPathChoicesOfField(dataSchema, 'running').map(
      (choice) => choice.pathKey,
    );

    // Assert: the session clock's running, alone.
    expect(pathKeys, 'only the clock running fits a switch').toEqual(['session:clock.running']);
  });

  it('offers the leader last lap to a text through the lap-time format, and a team name as it is', () => {
    // Arrange: the race clock's title, a text.
    const choices = listBindingPathChoicesOfField(raceClockManifest.schema, 'sessionName');

    // Act: find the two paths.
    const lastLap = choices.find((choice) => choice.pathKey === 'positions:entries.0.lastLapMs');
    const teamName = choices.find((choice) => choice.pathKey === 'positions:entries.0.teamName');

    // Assert: the lap needs its transform; the team fits without one.
    expect(lastLap, 'the lap fits through its format only').toMatchObject({
      label: 'Posições › 1º colocado › Última volta',
      fitsWithoutTransform: false,
      transformIdsThatFit: ['formatLapTimeAsText', 'formatGapAsText'],
    });
    expect(teamName, 'a team name fits as it is').toMatchObject({
      fitsWithoutTransform: true,
      transformIdsThatFit: ['shortenSchoolName'],
    });
  });

  it('lists the four whole lists for a list field, with topN on the positions', () => {
    // Arrange: the tower's list of cars.
    const choices = listBindingPathChoicesOfField(towerDataSchema, 'entries');

    // Act: read the keys and the positions choice.
    const pathKeys = choices.map((choice) => choice.pathKey);
    const positions = choices.find((choice) => choice.pathKey === 'positions:entries');

    // Assert: positions, standings, rounds and incidents, and topN offered on the positions.
    expect(pathKeys, 'the four whole lists').toEqual([
      'positions:entries',
      'standings:entries',
      'brackets:rounds',
      'incidents:entries',
    ]);
    expect(positions?.transformIdsThatFit, 'the first N cars').toEqual(['topN']);
  });
});

describe('canFieldBeBoundToASource and canFieldTakeTheWholeClock', () => {
  const fieldScenarios = [
    // A text field has plenty to read.
    {
      name: 'the tower title',
      dataSchema: towerDataSchema,
      fieldKey: 'title',
      canBind: true,
      canTakeWholeClock: false,
    },
    // An object has no canonical value to fill it.
    {
      name: 'the tower theme',
      dataSchema: towerDataSchema,
      fieldKey: 'theme',
      canBind: false,
      canTakeWholeClock: false,
    },
    // The race clock's time takes a number or the whole clock.
    {
      name: 'the race clock time',
      dataSchema: raceClockManifest.schema,
      fieldKey: 'referenceTimeMs',
      canBind: true,
      canTakeWholeClock: true,
    },
    // The moment is filled by the whole clock, never bound to it alone.
    {
      name: 'the race clock moment',
      dataSchema: raceClockManifest.schema,
      fieldKey: 'referenceWallClockMs',
      canBind: true,
      canTakeWholeClock: false,
    },
  ];

  it.each(fieldScenarios)(
    'answers for $name',
    ({ dataSchema, fieldKey, canBind, canTakeWholeClock }) => {
      // Arrange: the field of this row.

      // Act: ask both questions.
      const answers = [
        canFieldBeBoundToASource(dataSchema, fieldKey),
        canFieldTakeTheWholeClock(dataSchema, fieldKey),
      ];

      // Assert: "Fonte" and "Relógio da fonte" are offered as this row says.
      expect(answers, 'the kinds offered must be these').toEqual([canBind, canTakeWholeClock]);
    },
  );
});
