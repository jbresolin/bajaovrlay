/**
 * Reading an entity reference against the library (packages/shared)
 *
 * What this module is for:
 *   resolveEntityReferenceAgainstLibrary reads the value one entity reference gives now:
 *   the record found by its fixed key, then the attribute (BAJAOVRLAY-19). An image
 *   attribute gives the image's URL, /media/<mediaId>, which the graphic draws with <img>.
 *   The take, the live refresh and the item editor's "Valor agora" all run it, so they
 *   say the same thing about the same reference.
 *
 * What these tests prove:
 *   - Car 42's team name, a person's role, a sponsor's roll weight and a slot's start are
 *     read as stored.
 *   - Team 42's logo gives the URL /media/<mediaId>.
 *   - A record that is not in the library is unresolvable, with a pt-BR sentence naming
 *     the car, or for a person, sponsor or slot saying in words that it was deleted:
 *     their ids are UUIDs that tell the operator nothing (gate 2 of PR #23).
 *   - Team 7's logo, which it does not have, is an absent value naming the team and the
 *     field: the take leaves an optional field out. So is the city of a team with none.
 *   - An attribute the type does not have is unresolvable.
 *
 * What these tests deliberately do not cover:
 *   - What the take does with each answer; the resolver tests of apps/server.
 */
import { describe, expect, it } from 'vitest';

import type { EntityFieldValue } from './entityFieldValue.js';
import { buildLibraryOfTheRaceWeekend, logoOfTeam42MediaId } from './entityLibrary.testSupport.js';
import { resolveEntityReferenceAgainstLibrary } from './entityReferenceResolution.js';

describe('resolveEntityReferenceAgainstLibrary', () => {
  const valuesRead: Array<{ name: string; reference: EntityFieldValue; expected: unknown }> = [
    // The team card's title.
    {
      name: "reads car 42's team name",
      reference: { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'teamName' },
      expected: 'Baja UFPR',
    },
    // The line under the team's name.
    {
      name: "reads car 42's city",
      reference: { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'city' },
      expected: 'Curitiba',
    },
    // A lower third's second line.
    {
      name: "reads the narrator's role",
      reference: {
        kind: 'entity',
        entityType: 'person',
        personId: 'narrador-joao',
        attribute: 'role',
      },
      expected: 'Narrador',
    },
    // A whole number from a sponsor.
    {
      name: "reads the master sponsor's roll weight",
      reference: {
        kind: 'entity',
        entityType: 'sponsor',
        sponsorId: 'patrocinador-master',
        attribute: 'rollWeight',
      },
      expected: 10,
    },
    // A moment from the schedule.
    {
      name: "reads the enduro slot's start",
      reference: {
        kind: 'entity',
        entityType: 'scheduleSlot',
        slotId: 'enduro-sabado',
        attribute: 'startsAtMs',
      },
      expected: Date.parse('2026-11-14T13:00:00.000Z'),
    },
    // An image is an asset: the field holds its URL, the graphic draws it with <img>.
    {
      name: "gives car 42's logo as its /media URL",
      reference: { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'logoUrl' },
      expected: `/media/${logoOfTeam42MediaId}`,
    },
  ];

  it.each(valuesRead)('$name', ({ reference, expected }) => {
    // Arrange: the race weekend's library.
    const library = buildLibraryOfTheRaceWeekend();

    // Act: read the reference.
    const resolution = resolveEntityReferenceAgainstLibrary(reference, library);

    // Assert: the value as stored.
    expect(resolution, 'the value must be read as stored').toEqual({
      status: 'resolved',
      value: expected,
    });
  });

  it('says a team that is not in the library is missing, naming the car', () => {
    // Arrange: the library, which has no team for car 99.
    const library = buildLibraryOfTheRaceWeekend();

    // Act: read car 99's team name.
    const resolution = resolveEntityReferenceAgainstLibrary(
      { kind: 'entity', entityType: 'team', carNumber: 99, attribute: 'teamName' },
      library,
    );

    // Assert: unresolvable, naming the car, so the take is refused with that sentence.
    expect(resolution, 'a missing team must be named by its car').toEqual({
      status: 'unresolvable',
      problem: 'a equipe do carro 99 não está nos cadastros.',
    });
  });

  const missingRecords: Array<{ name: string; reference: EntityFieldValue; expected: string }> = [
    // A person deleted since the item was made: the id is a UUID the page made.
    {
      name: 'says a person no longer in the library was deleted, in words',
      reference: {
        kind: 'entity',
        entityType: 'person',
        personId: '0f6c2a9e-41d7-4b8e-9a35-7c1e5d2b8f40',
        attribute: 'name',
      },
      expected: 'lê uma pessoa excluída dos cadastros.',
    },
    // A sponsor deleted from the library.
    {
      name: 'says a sponsor no longer in the library was deleted, in words',
      reference: {
        kind: 'entity',
        entityType: 'sponsor',
        sponsorId: 'apoio-pneus',
        attribute: 'name',
      },
      expected: 'lê um patrocinador excluído dos cadastros.',
    },
    // A slot removed from the schedule.
    {
      name: 'says a slot no longer in the schedule was deleted, in words',
      reference: {
        kind: 'entity',
        entityType: 'scheduleSlot',
        slotId: '5b8d1e3f-7a9c-4e2b-8d6f-1a3c5e7b9d02',
        attribute: 'sessionName',
      },
      expected: 'lê uma sessão excluída da programação.',
    },
  ];

  it.each(missingRecords)('$name', ({ reference, expected }) => {
    // Arrange: the library, which no longer has the record of this row.
    const library = buildLibraryOfTheRaceWeekend();

    // Act: read the reference.
    const resolution = resolveEntityReferenceAgainstLibrary(reference, library);

    // Assert: unresolvable, in words and never by its id (gate 2 of PR #23).
    expect(resolution, 'a missing record is named in words').toEqual({
      status: 'unresolvable',
      problem: expected,
    });
  });

  it('says team 7 has no logo, naming the team and the field', () => {
    // Arrange: the library, where team 7 has no logo yet.
    const library = buildLibraryOfTheRaceWeekend();

    // Act: read team 7's logo.
    const resolution = resolveEntityReferenceAgainstLibrary(
      { kind: 'entity', entityType: 'team', carNumber: 7, attribute: 'logoUrl' },
      library,
    );

    // Assert: absent, so an optional field is left out and the card shows no logo.
    expect(resolution, 'a logo not uploaded is an absent value').toEqual({
      status: 'valueAbsent',
      problem: 'Equipe 7 (Juriti Off-Road) não tem Logo.',
    });
  });

  it('says a team with no city has none, so the card drops its place line', () => {
    // Arrange: the library, with team 13 added from an entry list that names no city.
    const library = buildLibraryOfTheRaceWeekend();
    library.teams.push({ carNumber: 13, teamName: 'Mutum Off-Road', schoolName: 'UFMT' });

    // Act: read team 13's city.
    const resolution = resolveEntityReferenceAgainstLibrary(
      { kind: 'entity', entityType: 'team', carNumber: 13, attribute: 'city' },
      library,
    );

    // Assert: absent (gate 2 of PR #23), so an optional field is left out of the take.
    expect(resolution, 'a city not typed is an absent value').toEqual({
      status: 'valueAbsent',
      problem: 'Equipe 13 (Mutum Off-Road) não tem Cidade.',
    });
  });

  it('says an attribute the type does not have cannot be read', () => {
    // Arrange: the library.
    const library = buildLibraryOfTheRaceWeekend();

    // Act: read a "points" attribute, which teams do not have.
    const resolution = resolveEntityReferenceAgainstLibrary(
      { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'points' },
      library,
    );

    // Assert: unresolvable, naming the attribute.
    expect(resolution, 'an unknown attribute must be refused').toEqual({
      status: 'unresolvable',
      problem: 'o cadastro de Equipe não tem o campo "points".',
    });
  });
});
