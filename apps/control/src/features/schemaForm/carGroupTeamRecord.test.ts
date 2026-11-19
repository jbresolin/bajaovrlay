/**
 * A group filled from one team record of Cadastros (apps/control)
 *
 * What this module is for:
 *   The team card has eight fields, and every one comes from the team's record in
 *   Cadastros: the operator picked the same team eight times per card. BAJAOVRLAY-80 lets
 *   a car group be filled from one team record: one pick, "Equipe dos Cadastros", writes
 *   each field as the ordinary per-field reference to that team ("Cadastro", BAJAOVRLAY-19),
 *   so a later edit in Cadastros reaches the card as it always did. These pure functions
 *   read whether a group's fields reference one team, decide how a group opens, and build
 *   the references a team pick writes.
 *
 * What these tests prove:
 *   - Fields that each read their own attribute of team 42 agree on team 42, and the
 *     group opens on "Equipe dos Cadastros".
 *   - Fields that read two teams, or one field reading another attribute (the school's
 *     full name in the school field), or one field typed among references, do not agree,
 *     and the group opens with "Campos separados" on, as -66 does for a car.
 *   - A new team card opens on "Equipe dos Cadastros" straight away, its plate switch off
 *     counting as nothing typed: a record is the only pick that fills it. A new notice,
 *     which can also follow a car in the positions, still asks how to fill it.
 *   - A team pick writes, for each field, a reference to that team's attribute of the
 *     field's own meaning; the team shown is read back from the first field.
 *
 * What these tests deliberately do not cover:
 *   - The picker on screen and what a save sends; ItemEditorPanelTeamGroup.test.tsx.
 *   - Picking a car in the positions; carGroupChoice.test.ts.
 *   - Which ways a group's meanings allow; carGroupFillingWays.test.ts in packages/shared.
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { chooseCarGroupWayAtOpening, readAgreementOfCarGroupFields } from './carGroupChoice';
import {
  buildTeamCardFieldsReadingTeam,
  buildTeamReference,
  fillNoticeFormForANewItem,
  fillTeamCardFormForANewItem,
  fillTeamCardFormFrom,
  readNoticeCarGroup,
  readTeamCardGroup,
} from './carGroupOfTheTeamCard.testSupport';
import {
  buildEntityReferenceValuesOfTeamRecord,
  readTeamRecordShownInGroup,
} from './carGroupTeamRecord';

describe('a team card whose fields read Cadastros', () => {
  // Each row is one way the team card's eight fields may have been stored.
  const storedFieldsScenarios = [
    {
      // What one pick of team 42 saves, or eight picks of team 42 made field by field.
      name: 'agrees on team 42 and opens on the team when every field reads team 42',
      fields: buildTeamCardFieldsReadingTeam(42),
      expectedAgreement: { status: 'oneTeamRecord', carNumberText: '42' },
      expectedWay: 'teamRecord',
    },
    {
      // A slip made field by field: the logo of team 7 on team 42's card.
      name: 'opens separate when one field reads another team',
      fields: { ...buildTeamCardFieldsReadingTeam(42), logoUrl: buildTeamReference(7, 'logoUrl') },
      expectedAgreement: { status: 'notOnePick' },
      expectedWay: 'separate',
    },
    {
      // A deliberate choice: the school's full name under the team, which a pick would undo.
      name: 'opens separate when one field reads another attribute of the same team',
      fields: {
        ...buildTeamCardFieldsReadingTeam(42),
        schoolName: buildTeamReference(42, 'schoolFullName'),
      },
      expectedAgreement: { status: 'notOnePick' },
      expectedWay: 'separate',
    },
    {
      // A city corrected by hand for one broadcast, the rest from Cadastros.
      name: 'opens separate when one field is typed among the references',
      fields: {
        ...buildTeamCardFieldsReadingTeam(42),
        city: { kind: 'literal', value: 'São José dos Pinhais' },
      } satisfies ItemFields,
      expectedAgreement: { status: 'notOnePick' },
      expectedWay: 'separate',
    },
  ];

  it.each(storedFieldsScenarios)('$name', ({ fields, expectedAgreement, expectedWay }) => {
    // Arrange: the team card's form filled from the stored fields of the row.
    const formValues = fillTeamCardFormFrom(fields);
    const teamGroup = readTeamCardGroup();

    // Act: read whether the fields agree, and how the group opens.
    const agreement = readAgreementOfCarGroupFields(teamGroup, formValues);
    const way = chooseCarGroupWayAtOpening(teamGroup, formValues);

    // Assert: the agreement and the way the row expects.
    expect(agreement, 'whether the eight fields read one team').toEqual(expectedAgreement);
    expect(way, 'how the "Equipe" group opens').toBe(expectedWay);
  });
});

describe('how a new item opens', () => {
  it('opens a new team card on "Equipe dos Cadastros", the plate switch off', () => {
    // Arrange: a new team card's form, every field at its default (the plate switch off).
    const formValues = fillTeamCardFormForANewItem();

    // Act: decide how its group opens.
    const way = chooseCarGroupWayAtOpening(readTeamCardGroup(), formValues);

    // Assert: on the team picker, since a team record is the only pick that fills it.
    expect(formValues.values.logoOnLightPlate, 'the switch starts off').toBe(false);
    expect(way, 'a new team card asks for the team right away').toBe('teamRecord');
  });

  it('still asks how to fill a new notice, which a car in the positions can fill too', () => {
    // Arrange: a new notice's form.
    const formValues = fillNoticeFormForANewItem();

    // Act: decide how its car group opens.
    const way = chooseCarGroupWayAtOpening(readNoticeCarGroup(), formValues);

    // Assert: nothing chosen yet, as before BAJAOVRLAY-80.
    expect(way, 'the notice keeps asking how to choose its car').toBe('notChosen');
  });

  it('opens a notice whose three fields read team 7 on the team', () => {
    // Arrange: a notice's form whose number, team and school read team 7 in Cadastros.
    const formValues = fillNoticeFormForANewItem();
    formValues.kinds = {
      ...formValues.kinds,
      carNumber: 'entity',
      teamName: 'entity',
      schoolName: 'entity',
    };
    formValues.entityReferences = {
      carNumber: { entityType: 'team', recordKey: '7', attribute: 'carNumber' },
      teamName: { entityType: 'team', recordKey: '7', attribute: 'teamName' },
      schoolName: { entityType: 'team', recordKey: '7', attribute: 'schoolName' },
    };

    // Act: decide how its car group opens.
    const way = chooseCarGroupWayAtOpening(readNoticeCarGroup(), formValues);

    // Assert: grouped on the team, so the operator sees one pick.
    expect(way, 'the notice must open on team 7').toBe('teamRecord');
  });
});

describe('what a team pick writes', () => {
  it("writes each field as a reference to team 42's attribute of the field's meaning", () => {
    // Arrange: the team card's group.
    const teamGroup = readTeamCardGroup();

    // Act: build the references a pick of team 42 writes.
    const references = buildEntityReferenceValuesOfTeamRecord(teamGroup, '42');

    // Assert: eight references to team 42, each to its own attribute.
    expect(references, 'every field must read its own attribute of team 42').toEqual({
      carNumber: { entityType: 'team', recordKey: '42', attribute: 'carNumber' },
      teamName: { entityType: 'team', recordKey: '42', attribute: 'teamName' },
      schoolName: { entityType: 'team', recordKey: '42', attribute: 'schoolName' },
      city: { entityType: 'team', recordKey: '42', attribute: 'city' },
      state: { entityType: 'team', recordKey: '42', attribute: 'state' },
      carPhotoUrl: { entityType: 'team', recordKey: '42', attribute: 'carPhotoUrl' },
      logoUrl: { entityType: 'team', recordKey: '42', attribute: 'logoUrl' },
      logoOnLightPlate: { entityType: 'team', recordKey: '42', attribute: 'logoOnLightPlate' },
    });
  });

  it('reads the team shown back from the first field, or none on a new card', () => {
    // Arrange: a card saved on team 42, and a new card.
    const savedCard = fillTeamCardFormFrom(buildTeamCardFieldsReadingTeam(42));
    const newCard = fillTeamCardFormForANewItem();

    // Act: read the team each one's picker shows.
    const teamShownOnTheSavedCard = readTeamRecordShownInGroup(readTeamCardGroup(), savedCard);
    const teamShownOnTheNewCard = readTeamRecordShownInGroup(readTeamCardGroup(), newCard);

    // Assert: team 42 on the saved card, nothing chosen on the new one.
    expect(teamShownOnTheSavedCard, 'the saved card shows team 42').toBe('42');
    expect(teamShownOnTheNewCard, 'a new card shows no team yet').toBe('');
  });
});
