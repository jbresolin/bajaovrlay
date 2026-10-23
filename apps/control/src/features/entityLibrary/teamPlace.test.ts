/**
 * The place of a team, as Cadastros writes it (apps/control)
 *
 * What this module is for:
 *   A team's city and state are optional (gate 2 of PR #23): an entry list often names
 *   neither. The Equipes table writes the place in one cell, "Curitiba – PR", and must
 *   never show a dangling dash for a team that has only one part, or none.
 *
 * What these tests prove:
 *   - Both parts give "Curitiba – PR"; one part alone gives that part; none gives nothing.
 *
 * What these tests deliberately do not cover:
 *   - The table itself; EntityLibraryPage.test.tsx.
 */
import type { Team } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { writePlaceOfTeam } from './teamPlace';

/** Team 42 with the place of the row. */
function buildTeam42WithPlace(place: { city?: string; state?: Team['state'] }): Team {
  return { carNumber: 42, teamName: 'Baja UFPR', schoolName: 'UFPR', ...place };
}

describe('writePlaceOfTeam', () => {
  const places = [
    // The whole place, as most teams have it.
    {
      name: 'writes the city and the state',
      place: { city: 'Curitiba', state: 'PR' as const },
      expected: 'Curitiba – PR',
    },
    // A city typed without its state.
    { name: 'writes the city alone', place: { city: 'Curitiba' }, expected: 'Curitiba' },
    // A state chosen without a city.
    { name: 'writes the state alone', place: { state: 'PR' as const }, expected: 'PR' },
    // An entry list with no place at all.
    { name: 'writes nothing for no place', place: {}, expected: undefined },
  ];

  it.each(places)('$name', ({ place, expected }) => {
    // Arrange: team 42 with this place.
    const team = buildTeam42WithPlace(place);

    // Act: write its place.
    const placeText = writePlaceOfTeam(team);

    // Assert: the text of this row.
    expect(placeText, 'the place as the table writes it').toBe(expected);
  });
});
