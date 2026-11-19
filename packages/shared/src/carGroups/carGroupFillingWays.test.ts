/**
 * Which ways can fill a car group (packages/shared)
 *
 * What this module is for:
 *   A car group (BAJAOVRLAY-66) is the fields of a graphic that describe one car. Its
 *   picker filled them from the positions only: one car by number or by place. The team
 *   card's fields (city, state, logo, car photo…) are not in the positions at all: they
 *   live in the team's record in Cadastros (BAJAOVRLAY-80). So a group's meanings may now
 *   also be attributes of a team record, and these functions say which ways can fill a
 *   group, judging by its meanings alone:
 *   - from the positions, when every meaning is a field of a car in the positions;
 *   - from one team record, when every meaning is an attribute of a team in Cadastros.
 *   The notice's car (number, team, school) can be filled both ways; the team card's only
 *   from a record; the battle card's (position, laps) only from the positions.
 *
 * What these tests prove:
 *   - The meanings of a team record are exactly the team attributes the entity library
 *     lists, so a new attribute cannot be forgotten here.
 *   - Each of the three real kinds of group (battle card, notice, team card) is offered
 *     the ways the list above says, and no other.
 *   - A meaning is told apart as a car field, a team attribute, both, or neither.
 *
 * What these tests deliberately do not cover:
 *   - Whether each field fits its meaning; carGroupsOfManifest.test.ts.
 *   - What the editor draws for each way; carGroupChoice.test.ts and
 *     ItemEditorPanelTeamGroup.test.tsx in apps/control.
 */
import { describe, expect, it } from 'vitest';

import { listAttributesOfEntityType } from '../entities/entityAttributes.js';
import type { CarGroup } from './carGroup.js';
import {
  canCarGroupBeFilledFromATeamRecord,
  canCarGroupBeFilledFromThePositions,
  isMeaningAFieldOfACarInThePositions,
  isMeaningAnAttributeOfATeamRecord,
  teamRecordFieldMeanings,
} from './carGroupFillingWays.js';

/** The battle card's car ahead: its position and laps exist in the positions only. */
function buildCarAheadOfTheBattleCard(): CarGroup {
  return {
    id: 'ahead',
    label: 'Carro da frente',
    fields: {
      aheadPosition: 'position',
      aheadCarNumber: 'carNumber',
      aheadTeamName: 'teamName',
      aheadSchoolName: 'schoolName',
      aheadLaps: 'laps',
    },
  };
}

/** The notice's car: number, team and school, which both the positions and a record have. */
function buildCarOfTheNotice(): CarGroup {
  return {
    id: 'car',
    label: 'Carro',
    fields: { carNumber: 'carNumber', teamName: 'teamName', schoolName: 'schoolName' },
  };
}

/** The team card's team: its city, state, logo and photo exist in a team record only. */
function buildTeamOfTheTeamCard(): CarGroup {
  return {
    id: 'team',
    label: 'Equipe',
    fields: {
      carNumber: 'carNumber',
      teamName: 'teamName',
      schoolName: 'schoolName',
      city: 'city',
      state: 'state',
      carPhotoUrl: 'carPhotoUrl',
      logoUrl: 'logoUrl',
      logoOnLightPlate: 'logoOnLightPlate',
    },
  };
}

describe('the meanings of a team record', () => {
  it('are exactly the attributes of a team in the entity library, in its order', () => {
    // Arrange: the team attributes the item editor's "Cadastro" offers.
    const teamAttributeKeys = listAttributesOfEntityType('team').map(
      (attribute) => attribute.attributeKey,
    );

    // Act: read the meanings a group may give a field read from a team record.
    const meanings = [...teamRecordFieldMeanings];

    // Assert: the same list, so the two can never drift apart.
    expect(meanings, 'every team attribute must be a meaning, and nothing else').toEqual(
      teamAttributeKeys,
    );
  });
});

describe('the ways a car group can be filled', () => {
  // Each row is one of the real graphics' groups, and the ways its meanings allow.
  const groupScenarios = [
    {
      // Position and laps change during the race: only the positions have them.
      name: "fills the battle card's car from the positions only",
      buildGroup: buildCarAheadOfTheBattleCard,
      expectedFromThePositions: true,
      expectedFromATeamRecord: false,
    },
    {
      // Number, team and school are in both, so the notice may use either.
      name: "fills the notice's car from the positions or from a team record",
      buildGroup: buildCarOfTheNotice,
      expectedFromThePositions: true,
      expectedFromATeamRecord: true,
    },
    {
      // City, state, logo and photo are in Cadastros only.
      name: "fills the team card's team from a team record only",
      buildGroup: buildTeamOfTheTeamCard,
      expectedFromThePositions: false,
      expectedFromATeamRecord: true,
    },
  ];

  it.each(groupScenarios)(
    '$name',
    ({ buildGroup, expectedFromThePositions, expectedFromATeamRecord }) => {
      // Arrange: the group as its graphic's manifest declares it.
      const carGroup = buildGroup();

      // Act: ask which ways can fill it.
      const isFilledFromThePositions = canCarGroupBeFilledFromThePositions(carGroup);
      const isFilledFromATeamRecord = canCarGroupBeFilledFromATeamRecord(carGroup);

      // Assert: exactly the ways the row expects.
      expect(isFilledFromThePositions, 'whether a car pick in the positions can fill it').toBe(
        expectedFromThePositions,
      );
      expect(isFilledFromATeamRecord, 'whether one team record can fill it').toBe(
        expectedFromATeamRecord,
      );
    },
  );
});

describe('telling a meaning apart', () => {
  // Each row is one meaning and where it can be read from.
  const meaningScenarios = [
    // In both: a car's number is in the positions and in its team's record.
    { meaning: 'carNumber', isCarField: true, isTeamAttribute: true },
    // The positions only: laps change during the race.
    { meaning: 'laps', isCarField: true, isTeamAttribute: false },
    // A team record only: the city never changes during the race.
    { meaning: 'city', isCarField: false, isTeamAttribute: true },
    // Neither: a misspelt meaning.
    { meaning: 'lapsDone', isCarField: false, isTeamAttribute: false },
  ];

  it.each(meaningScenarios)(
    'reads "$meaning" as a car field: $isCarField, a team attribute: $isTeamAttribute',
    ({ meaning, isCarField, isTeamAttribute }) => {
      // Arrange: the meaning as a manifest writes it (the row's).

      // Act: ask both questions.
      const isFieldOfACar = isMeaningAFieldOfACarInThePositions(meaning);
      const isAttributeOfATeam = isMeaningAnAttributeOfATeamRecord(meaning);

      // Assert: the answers the row expects.
      expect(isFieldOfACar, `whether ${meaning} is a field of a car in the positions`).toBe(
        isCarField,
      );
      expect(isAttributeOfATeam, `whether ${meaning} is an attribute of a team record`).toBe(
        isTeamAttribute,
      );
    },
  );
});
