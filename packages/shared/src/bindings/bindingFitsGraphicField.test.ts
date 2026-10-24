/**
 * Which bindings fit which field of a graphic (packages/shared)
 *
 * What this module is for:
 *   A bound value must fit the graphic's field it fills: a text path for a text field,
 *   a whole list for a list field, a whole number for a whole-number field. The item
 *   editor offers only the paths that fit, and the server refuses a binding that does
 *   not when the item is saved (brief A). Both read the field's type from the graphic's
 *   manifest schema, through the functions tested here. The clock group (the whole
 *   session clock) fits only the field a graphic marks with the role clockTime, and
 *   only when the graphic marks all four clock roles, because it fills all four at once.
 *
 * What these tests prove:
 *   - Each kind of manifest field takes the value types the table below says, the race
 *     clock's time field taking the clock group as well.
 *   - A field the schema does not declare, and an object field, take nothing.
 *   - findClockFieldKeysByRole finds the race clock's four clock fields by role, and
 *     answers undefined for a graphic without them.
 *   - findProblemInBindingForGraphicField names the field and the path when the value
 *     does not fit, passes a binding that fits, and passes on a problem of the binding
 *     itself.
 *
 * What these tests deliberately do not cover:
 *   - Whether the value read on air fits the enum or the limits of the field; the take
 *     checks the resolved data against the whole manifest schema.
 */
import { describe, expect, it } from 'vitest';

import type { BindingFieldValue } from './bindingFieldValue.js';
import {
  findClockFieldKeysByRole,
  findProblemInBindingForGraphicField,
  listValueTypesThatFitGraphicField,
} from './bindingFitsGraphicField.js';
import {
  buildPositionsTowerGraphic,
  buildRaceClockGraphicFromItsManifest,
} from './graphicsForBindingTests.testSupport.js';

describe('listValueTypesThatFitGraphicField', () => {
  const fieldScenarios = [
    // A text field takes any text, the flag included (shown as its value).
    {
      name: 'the race clock title takes text and the flag',
      graphic: buildRaceClockGraphicFromItsManifest(),
      fieldKey: 'sessionName',
      expectedTypes: ['text', 'stateEnum'],
    },
    // The time of the race clock: a whole number, or the whole clock as one.
    {
      name: 'the race clock reference time takes a whole number and the clock group',
      graphic: buildRaceClockGraphicFromItsManifest(),
      fieldKey: 'referenceTimeMs',
      expectedTypes: ['integer', 'clockGroup'],
    },
    // The moment of the clock is filled by the clock group, never bound to it alone.
    {
      name: 'the race clock reference moment takes a whole number only',
      graphic: buildRaceClockGraphicFromItsManifest(),
      fieldKey: 'referenceWallClockMs',
      expectedTypes: ['integer'],
    },
    // A switch takes yes or no.
    {
      name: 'the race clock running switch takes a boolean',
      graphic: buildRaceClockGraphicFromItsManifest(),
      fieldKey: 'running',
      expectedTypes: ['boolean'],
    },
    // A list field takes any of the whole lists; the take checks the elements.
    {
      name: 'the tower list takes the five whole lists',
      graphic: buildPositionsTowerGraphic(),
      fieldKey: 'entries',
      expectedTypes: [
        'positionsEntries',
        'standingsEntries',
        'standingsScoreParts',
        'bracketsRounds',
        'incidentsEntries',
      ],
    },
    // A decimal number takes a whole number too: 400 points is a number.
    {
      name: 'the tower points take a whole and a decimal number',
      graphic: buildPositionsTowerGraphic(),
      fieldKey: 'leaderPoints',
      expectedTypes: ['integer', 'number'],
    },
    // A whole-number field never takes 12.5 points.
    {
      name: 'the tower car count takes a whole number only',
      graphic: buildPositionsTowerGraphic(),
      fieldKey: 'carsShown',
      expectedTypes: ['integer'],
    },
    // An object field has no canonical value to fill it.
    {
      name: 'the tower theme, an object, takes nothing',
      graphic: buildPositionsTowerGraphic(),
      fieldKey: 'theme',
      expectedTypes: [],
    },
    // A field the schema does not declare cannot be filled at all.
    {
      name: 'a field the race clock does not declare takes nothing',
      graphic: buildRaceClockGraphicFromItsManifest(),
      fieldKey: 'teamName',
      expectedTypes: [],
    },
  ];

  it.each(fieldScenarios)('$name', ({ graphic, fieldKey, expectedTypes }) => {
    // Arrange: the graphic and field of this row.

    // Act: list the value types that fit the field.
    const valueTypes = listValueTypesThatFitGraphicField(graphic, fieldKey);

    // Assert: exactly the types of this row.
    expect(valueTypes, 'the field must take exactly these value types').toEqual(expectedTypes);
  });
});

describe('findClockFieldKeysByRole', () => {
  it('finds the four clock fields of the race clock by their roles', () => {
    // Arrange: the race clock, whose manifest marks its four clock fields.
    const raceClock = buildRaceClockGraphicFromItsManifest();

    // Act: find the fields by role.
    const clockFieldKeys = findClockFieldKeysByRole(raceClock);

    // Assert: one field per role, by the names the manifest gives them.
    expect(clockFieldKeys, 'each role must point at its field').toEqual({
      clockTime: 'referenceTimeMs',
      wallClock: 'referenceWallClockMs',
      clockRunning: 'running',
      clockMode: 'clockMode',
    });
  });

  it('answers undefined for a graphic that marks no clock', () => {
    // Arrange: the tower, which has no clock.
    const tower = buildPositionsTowerGraphic();

    // Act: look for its clock fields.
    const clockFieldKeys = findClockFieldKeysByRole(tower);

    // Assert: none, so no field of it takes the clock group.
    expect(clockFieldKeys, 'a graphic without a clock has no clock fields').toBeUndefined();
  });
});

describe('findProblemInBindingForGraphicField', () => {
  /** A live binding to the simulator's session at the path given. */
  function buildLiveSessionBinding(path: string): BindingFieldValue {
    return {
      kind: 'binding',
      sourceId: 'simulador-enduro',
      shapeKey: 'session',
      path,
      isLive: true,
    };
  }

  it('passes the flag bound to the race clock flag', () => {
    // Arrange: the race clock and the flag of the simulator.
    const raceClock = buildRaceClockGraphicFromItsManifest();

    // Act: check the binding against the clock's flag field.
    const problem = findProblemInBindingForGraphicField(
      buildLiveSessionBinding('state'),
      raceClock,
      'state',
    );

    // Assert: it fits.
    expect(problem, 'the flag must fit the flag field').toBeUndefined();
  });

  it('refuses the session name on the running switch, naming the field and the path', () => {
    // Arrange: a text bound to a switch, a mistake the picker would not offer.
    const raceClock = buildRaceClockGraphicFromItsManifest();

    // Act: check it.
    const problem = findProblemInBindingForGraphicField(
      buildLiveSessionBinding('sessionName'),
      raceClock,
      'running',
    );

    // Assert: the pt-BR sentence names the path; the server adds the field's title.
    expect(problem, 'a text must not fit a switch').toBe(
      'Sessão › Nome da sessão não serve para este campo.',
    );
  });

  it('refuses the whole clock on the running switch, which only the time field takes', () => {
    // Arrange: the clock group bound to the wrong clock field.
    const raceClock = buildRaceClockGraphicFromItsManifest();

    // Act: check it.
    const problem = findProblemInBindingForGraphicField(
      buildLiveSessionBinding('clock'),
      raceClock,
      'running',
    );

    // Assert: refused; the clock group is stored on the time field only.
    expect(problem, 'the clock group must go on the time field').toBe(
      'Sessão › Relógio completo não serve para este campo.',
    );
  });

  it('passes on a problem of the binding itself before judging the field', () => {
    // Arrange: a path the session does not list.
    const raceClock = buildRaceClockGraphicFromItsManifest();

    // Act: check it.
    const problem = findProblemInBindingForGraphicField(
      buildLiveSessionBinding('bandeira'),
      raceClock,
      'state',
    );

    // Assert: the binding's own problem, which is the real cause.
    expect(problem, 'the binding problem must come first').toBe(
      'O caminho "bandeira" não é um dos que a forma Sessão oferece.',
    );
  });
});
