/**
 * Whether an item that reads a whole list from Cadastros can be taken now (apps/control)
 *
 * What this module is for:
 *   itemEntityReadiness.ts tells a rundown row or a shortcut button that a take would be
 *   refused before the operator presses it. Since BAJAOVRLAY-46 a field may read a whole
 *   list ("Lista dos cadastros"): a sponsor roll whose sponsors have no logo yet has an
 *   empty list, which the server refuses on a required field and leaves out of an
 *   optional one (gate 2 of PR #28).
 *
 * What these tests prove:
 *   - An item with a list field reads the library, so it carries the marker.
 *   - A required list that is empty now (no sponsor with a logo) gives the server's reason,
 *     the field's title first; the same list with the 17 logos gives none.
 *   - An optional list that is empty now gives none: the take leaves the part out.
 *
 * What these tests deliberately do not cover:
 *   - The marker's words and tooltip; ItemEntityMarker.test.tsx. A single record;
 *     the same file.
 */
import type { EntityLibrary, Graphic, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildBoardWithEntityListsDataSchema,
  buildLibraryOfThe30thCompetition,
} from '@/features/schemaForm/boardWithEntityListsFixtureSchema.testSupport';

import {
  doesItemReadTheLibrary,
  findWhyItemCannotBeTakenNowFromTheLibrary,
} from './itemEntityReadiness';

/** The board as the server registers it, its sponsors required or optional. */
function buildBoardGraphic(areSponsorsRequired: boolean): Graphic {
  return {
    id: 'sponsor-roll',
    manifest: {
      id: 'baja-sponsor-roll',
      name: 'Rodízio de patrocinadores',
      main: 'sponsor-roll.js',
      schema: {
        ...buildBoardWithEntityListsDataSchema(),
        required: areSponsorsRequired ? ['sponsors'] : [],
      },
    },
    defaultLayerId: 'fullscreen',
    category: 'sponsor',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The roll item whose sponsors are "Lista dos cadastros" › Patrocinadores. */
function buildRollItemReadingEverySponsor(): Item {
  return {
    id: 'item-rodizio',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'sponsor-roll',
    layerId: 'fullscreen',
    fields: { sponsors: { kind: 'entityList', entityType: 'sponsor' } },
    label: 'Rodízio — patrocinadores',
    color: 'neutral',
    notes: '',
  };
}

/** The 30ª Competição's library before any logo is uploaded: the sponsors, no logo each. */
function buildLibraryWithNoLogoYet(): EntityLibrary {
  const library = buildLibraryOfThe30thCompetition();
  return {
    ...library,
    sponsors: library.sponsors.map((sponsor) => ({
      sponsorId: sponsor.sponsorId,
      name: sponsor.name,
      tier: sponsor.tier,
      rollWeight: sponsor.rollWeight,
    })),
  };
}

describe('an item reading a whole list from Cadastros', () => {
  it('reads the library, so it carries the marker', () => {
    // Arrange: the roll item.
    const item = buildRollItemReadingEverySponsor();

    // Act: ask whether it reads the library.
    const isReadingTheLibrary = doesItemReadTheLibrary(item);

    // Assert: it does.
    expect(isReadingTheLibrary, 'a list field reads the library').toBe(true);
  });

  const readinessScenarios = [
    // Required, and no sponsor has a logo yet: the server would refuse the take.
    {
      name: 'cannot be taken when a required list is empty now',
      areSponsorsRequired: true,
      library: buildLibraryWithNoLogoYet(),
      expected: 'Patrocinadores: nenhum patrocinador com logo nos cadastros.',
    },
    // Required, with the 17 logos: the take goes through.
    {
      name: 'can be taken when the required list has sponsors',
      areSponsorsRequired: true,
      library: buildLibraryOfThe30thCompetition(),
      expected: undefined,
    },
    // Optional and empty: the take leaves the part out, so nothing to warn about.
    {
      name: 'can be taken when an optional list is empty now',
      areSponsorsRequired: false,
      library: buildLibraryWithNoLogoYet(),
      expected: undefined,
    },
  ];

  it.each(readinessScenarios)('$name', ({ areSponsorsRequired, library, expected }) => {
    // Arrange: the roll item and the board with its sponsors required or not.
    const item = buildRollItemReadingEverySponsor();
    const graphic = buildBoardGraphic(areSponsorsRequired);

    // Act: ask why it could not be taken now.
    const reason = findWhyItemCannotBeTakenNowFromTheLibrary(item, graphic, library);

    // Assert: the server's reason, or none.
    expect(reason, 'the take as the server would answer it').toBe(expected);
  });
});
