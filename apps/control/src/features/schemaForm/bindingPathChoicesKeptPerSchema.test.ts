/**
 * A field's path choices are worked out once per graphic schema (apps/control)
 *
 * What this module is for:
 *   Which paths a field may read ("O que … lê da fonte") depends on the graphic's data
 *   schema and on the shapes' paths, both fixed while the editor is open, and never on the
 *   data a source sends. Working the list out for every field at every draw cost the item
 *   editor its speed during a race (BAJAOVRLAY-45), so the list of each field is kept per
 *   schema object (bindingPathChoicesKeptPerSchema.ts) and handed back from there.
 *
 * What these tests prove:
 *   - Asked twice for the same field of the same schema, listBindingPathChoicesOfField
 *     hands back the very same list.
 *   - Another field of the same schema gets a list of its own.
 *   - Another schema object (a graphic registered again after a reconnect, an equal copy)
 *     gets its list worked out again, with the same choices.
 *   - A schema that is not an object is worked out at every call and kept nowhere.
 *
 * What these tests deliberately do not cover:
 *   - Which paths fit which field: bindingChoices.test.ts.
 */
import battleCardManifest from '@bajaovrlay/battle-card/battle-card.ograf.json';
import { describe, expect, it } from 'vitest';

import { listBindingPathChoicesOfField } from './bindingChoices';

/** The battle card's data schema, as a newly registered graphic carries it. */
function copyBattleCardDataSchema(): unknown {
  return structuredClone(battleCardManifest.schema);
}

describe('listBindingPathChoicesOfField, asked again', () => {
  it('hands back the very same list for the same field of the same schema', () => {
    // Arrange: the battle card's schema, and the leader's team's choices worked out once.
    const dataSchema = copyBattleCardDataSchema();
    const choicesFirst = listBindingPathChoicesOfField(dataSchema, 'aheadTeamName');

    // Act: ask again, as the next draw of the field does.
    const choicesAgain = listBindingPathChoicesOfField(dataSchema, 'aheadTeamName');

    // Assert: the same list, not one worked out again.
    expect(choicesAgain, 'the choices must be worked out once and kept').toBe(choicesFirst);
  });

  it('keeps a list of its own for each field of the schema', () => {
    // Arrange: the battle card's schema.
    const dataSchema = copyBattleCardDataSchema();

    // Act: the choices of the team (a text) and of the laps (a whole number).
    const teamChoices = listBindingPathChoicesOfField(dataSchema, 'aheadTeamName');
    const lapsChoices = listBindingPathChoicesOfField(dataSchema, 'aheadLaps');

    // Assert: different lists, each fitting its own field.
    expect(
      teamChoices.map((choice) => choice.pathKey),
      'the team reads the car’s team',
    ).toContain('positions:entryOfCar.teamName');
    expect(
      lapsChoices.map((choice) => choice.pathKey),
      'the laps read the car’s laps',
    ).toContain('positions:entryOfCar.laps');
    expect(lapsChoices, 'each field must have a list of its own').not.toBe(teamChoices);
  });

  it('works the list out again for another schema object, with the same choices', () => {
    // Arrange: the choices of the leader's team in one copy of the schema.
    const choicesOfTheFirstCopy = listBindingPathChoicesOfField(
      copyBattleCardDataSchema(),
      'aheadTeamName',
    );

    // Act: the same field in an equal copy, as after the graphic is registered again.
    const choicesOfTheSecondCopy = listBindingPathChoicesOfField(
      copyBattleCardDataSchema(),
      'aheadTeamName',
    );

    // Assert: worked out again (another list), and the same choices.
    expect(choicesOfTheSecondCopy, 'another schema object must have its own list').not.toBe(
      choicesOfTheFirstCopy,
    );
    expect(choicesOfTheSecondCopy, 'an equal schema must offer the same choices').toEqual(
      choicesOfTheFirstCopy,
    );
  });

  it('keeps nothing for a schema that is not an object', () => {
    // Arrange: a graphic whose manifest has no data schema at all.
    const noDataSchema = undefined;

    // Act: ask twice for a field of it.
    const choicesFirst = listBindingPathChoicesOfField(noDataSchema, 'title');
    const choicesAgain = listBindingPathChoicesOfField(noDataSchema, 'title');

    // Assert: nothing to read either time, and nothing kept between the two.
    expect(choicesFirst, 'no schema, no field to read into').toEqual([]);
    expect(choicesAgain, 'nothing is kept without a schema object').not.toBe(choicesFirst);
  });
});
