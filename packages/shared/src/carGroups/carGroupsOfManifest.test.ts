/**
 * A graphic's car groups, read from its manifest (packages/shared)
 *
 * What this module is for:
 *   A graphic may say which of its fields describe one car, and what each of them is
 *   (BAJAOVRLAY-66): the battle card's "Carro da frente" is its position, number, team,
 *   school and laps. The item editor then shows one car picker for the group in place of
 *   those fields. The groups live in the manifest's `v_baja.carGroups`, beside the other
 *   `v_baja` fields, and readCarGroupsOfManifest checks them against the manifest's own
 *   data schema before anything uses them.
 *
 * What these tests prove:
 *   - The battle card's two groups are read as written, the car behind naming the group
 *     it runs right behind.
 *   - A manifest without groups reads as "none", so every other graphic is untouched.
 *   - Each mistake is refused with a sentence naming it: a field in two groups, a field
 *     the schema does not have, an unknown meaning, a meaning whose value does not fit
 *     the field, a group named twice, a group with no field, and a group said to run
 *     behind one that does not exist.
 *
 * What these tests deliberately do not cover:
 *   - The real manifests' groups; each graphic's manifest test reads its own.
 *   - What the editor does with a group; carGroupChoice.test.ts and
 *     ItemEditorPanelCarGroups.test.tsx in apps/control.
 */
import { describe, expect, it } from 'vitest';

import { readCarGroupsOfManifest } from './carGroupsOfManifest.js';

/** The battle card's data schema, cut down to the fields its two cars and the gap use. */
function buildBattleCardDataSchema() {
  return {
    type: 'object',
    properties: {
      aheadPosition: { type: 'integer', title: 'Posição do carro da frente' },
      aheadCarNumber: { type: 'integer', title: 'Número do carro da frente' },
      aheadTeamName: { type: 'string', title: 'Equipe do carro da frente' },
      aheadSchoolName: { type: 'string', title: 'Escola do carro da frente' },
      aheadLaps: { type: 'integer', title: 'Voltas do carro da frente' },
      behindPosition: { type: 'integer', title: 'Posição do carro de trás' },
      behindCarNumber: { type: 'integer', title: 'Número do carro de trás' },
      behindTeamName: { type: 'string', title: 'Equipe do carro de trás' },
      behindSchoolName: { type: 'string', title: 'Escola do carro de trás' },
      behindLaps: { type: 'integer', title: 'Voltas do carro de trás' },
      gapMs: { type: 'integer', title: 'Diferença entre os carros (ms)' },
    },
  };
}

/** One car group as a manifest writes it, before anything checks it. */
type CarGroupAsWritten = {
  id: string;
  label: string;
  rightBehindGroup?: string;
  fields: Record<string, string>;
};

/** The battle card's two groups, exactly as its manifest writes them. */
function buildBattleCardCarGroups(): CarGroupAsWritten[] {
  return [
    {
      id: 'ahead',
      label: 'Carro da frente',
      fields: {
        aheadPosition: 'position',
        aheadCarNumber: 'carNumber',
        aheadTeamName: 'teamName',
        aheadSchoolName: 'schoolName',
        aheadLaps: 'laps',
      },
    },
    {
      id: 'behind',
      label: 'Carro de trás',
      rightBehindGroup: 'ahead',
      fields: {
        behindPosition: 'position',
        behindCarNumber: 'carNumber',
        behindTeamName: 'teamName',
        behindSchoolName: 'schoolName',
        behindLaps: 'laps',
        gapMs: 'intervalMs',
      },
    },
  ];
}

/** The group at this place of the list; the battle card always has two. */
function readGroupAt(carGroups: CarGroupAsWritten[], index: number): CarGroupAsWritten {
  const carGroup = carGroups[index];
  if (carGroup === undefined) {
    throw new Error(`the battle card has no car group at ${index}`);
  }
  return carGroup;
}

/** A battle card manifest with the car groups given (left out when undefined). */
function buildBattleCardManifestWithCarGroups(carGroups: unknown) {
  const vendorFields: Record<string, unknown> = { defaultLayerId: 'lower-third' };
  if (carGroups !== undefined) {
    vendorFields.carGroups = carGroups;
  }
  return {
    id: 'baja-battle-card',
    name: 'Disputa de posição',
    main: 'battle-card.js',
    schema: buildBattleCardDataSchema(),
    v_baja: vendorFields,
  };
}

describe('readCarGroupsOfManifest', () => {
  it("reads the battle card's two cars as written", () => {
    // Arrange: the battle card's manifest with its two groups.
    const manifest = buildBattleCardManifestWithCarGroups(buildBattleCardCarGroups());

    // Act: read its car groups.
    const reading = readCarGroupsOfManifest(manifest);

    // Assert: both groups, fields and meanings unchanged, the car behind naming the car ahead.
    expect(reading, 'the two groups must be read exactly as the manifest writes them').toEqual({
      status: 'groups',
      carGroups: buildBattleCardCarGroups(),
    });
  });

  it('reads "none" for a manifest that declares no car group', () => {
    // Arrange: the same manifest with no `carGroups` at all, like the race clock's.
    const manifest = buildBattleCardManifestWithCarGroups(undefined);

    // Act: read its car groups.
    const reading = readCarGroupsOfManifest(manifest);

    // Assert: nothing to group, and nothing refused.
    expect(reading, 'a graphic without groups keeps its fields one by one').toEqual({
      status: 'none',
    });
  });

  // Each row is one mistake an author could make; the refusal must name it.
  const refusedCarGroupScenarios = [
    {
      // The same field cannot follow two cars at once: which car would it read?
      name: 'refuses a field in two groups',
      changeTheGroups: (carGroups: CarGroupAsWritten[]) => {
        readGroupAt(carGroups, 1).fields.aheadLaps = 'laps';
      },
      expectedProblem: 'the field "aheadLaps" is in two car groups ("ahead" and "behind")',
    },
    {
      // A misspelt key would make the picker fill a field the graphic never receives.
      name: 'refuses a field the data schema does not have',
      changeTheGroups: (carGroups: CarGroupAsWritten[]) => {
        readGroupAt(carGroups, 0).fields.aheadLap = 'laps';
      },
      expectedProblem:
        'the car group "ahead" names the field "aheadLap", which the data schema does not have',
    },
    {
      // A meaning must be a field of a car in the positions, or the picker cannot read it.
      name: 'refuses an unknown meaning',
      changeTheGroups: (carGroups: CarGroupAsWritten[]) => {
        readGroupAt(carGroups, 0).fields.aheadLaps = 'lapsDone';
      },
      expectedProblem:
        'the car group "ahead" gives the field "aheadLaps" the meaning "lapsDone", which is not a field of a car',
    },
    {
      // A team name cannot go into a whole-number field: the take would refuse it.
      name: 'refuses a meaning whose value does not fit the field',
      changeTheGroups: (carGroups: CarGroupAsWritten[]) => {
        readGroupAt(carGroups, 0).fields.aheadCarNumber = 'teamName';
      },
      expectedProblem:
        'the car group "ahead" gives the field "aheadCarNumber" the meaning "teamName", whose value does not fit it',
    },
    {
      // Two groups with one id could not be told apart by the editor.
      name: 'refuses a group named twice',
      changeTheGroups: (carGroups: CarGroupAsWritten[]) => {
        const groupOfTheCarBehind = readGroupAt(carGroups, 1);
        groupOfTheCarBehind.id = 'ahead';
        delete groupOfTheCarBehind.rightBehindGroup;
      },
      expectedProblem: 'the car group "ahead" is declared twice',
    },
    {
      // A group with nothing in it would draw a picker that fills nothing.
      name: 'refuses a group with no field',
      changeTheGroups: (carGroups: CarGroupAsWritten[]) => {
        readGroupAt(carGroups, 0).fields = {};
      },
      expectedProblem: 'the car group "ahead" has no field',
    },
    {
      // "Disputa pela 2ª posição" needs to know which car runs right ahead of which.
      name: 'refuses a group said to run behind a group that does not exist',
      changeTheGroups: (carGroups: CarGroupAsWritten[]) => {
        readGroupAt(carGroups, 1).rightBehindGroup = 'leader';
      },
      expectedProblem: 'the car group "behind" runs right behind "leader", which is no car group',
    },
  ];

  it.each(refusedCarGroupScenarios)('$name', ({ changeTheGroups, expectedProblem }) => {
    // Arrange: the battle card's groups with one mistake made in them.
    const carGroups = buildBattleCardCarGroups();
    changeTheGroups(carGroups);
    const manifest = buildBattleCardManifestWithCarGroups(carGroups);

    // Act: read the car groups.
    const reading = readCarGroupsOfManifest(manifest);

    // Assert: refused, with a sentence naming the mistake.
    expect(reading.status, 'a group with a mistake must be refused as a whole').toBe('refused');
    expect(
      reading.status === 'refused' ? reading.problems : [],
      'the refusal must say what is wrong',
    ).toContain(expectedProblem);
  });
});
