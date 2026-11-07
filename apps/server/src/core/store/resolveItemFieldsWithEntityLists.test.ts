/**
 * Resolving item fields that read a whole list of the entity library (apps/server)
 *
 * What this module is for:
 *   An item field of kind `entityList` (BAJAOVRLAY-46) reads every sponsor, or every slot
 *   of the schedule, at the take and at a preview: the sponsor roll's sponsors, the
 *   sessions board's slots. The resolver reads the list with the shared
 *   resolveEntityListAgainstLibrary and is handed the library as plain data. An empty list
 *   refuses a required field, naming it in pt-BR, and leaves an optional one out (the
 *   intermission board draws no sponsor line then). The item's save runs the shared fit
 *   check, so a list on a field it does not fit is refused while preparing the show.
 *
 * What these tests prove:
 *   - Every sponsor with a logo reaches the roll's list at the take, in round order.
 *   - Every slot reaches the sessions board's list, by start.
 *   - An empty list refuses the take of a required field (ENTITY_NOT_RESOLVED, the field's
 *     title first) and leaves an optional field out of the data.
 *   - Saving a list of slots on the sponsors' field is refused (INVALID_ENTITY_REFERENCE);
 *     saving every sponsor there is not, even with no sponsor in Cadastros yet.
 *
 * What these tests deliberately do not cover:
 *   - The order and the items themselves; entityListResolution.test.ts in shared.
 *   - The refresh on air after an edit; modules/bindings' liveRefreshEntityLists.test.ts.
 */
import type { EntityLibrary, Graphic, ItemFields } from '@bajaovrlay/shared';
import { buildFakeMediaId } from '@bajaovrlay/shared/fakeMediaIds.testSupport';
import { describe, expect, it } from 'vitest';

import { findRefusalOfEntityFieldsForGraphic } from './itemEntityFields.js';
import { resolveItemFieldsIntoGraphicData } from './resolveItemFields.js';
import {
  buildSourcesAtLap34,
  momentOfTheTake,
} from './resolveItemFieldsWithBindings.testSupport.js';
import { buildEmptyLibrary } from './resolveItemFieldsWithEntities.testSupport.js';

/** The media ids of Bosch's and SAE Brasil's logos. */
const boschLogoMediaId = buildFakeMediaId(8);
const saeLogoMediaId = buildFakeMediaId(9);

/**
 * A board with a list of sponsors and a list of slots, `required` naming which must be
 * there. A stand-in with only the fields these tests read, so they do not depend on the
 * real packages.
 */
function buildBoardWithListsGraphic(required: string[]): Graphic {
  return {
    id: 'board-with-lists',
    manifest: {
      id: 'baja-board-with-lists',
      name: 'Quadro com listas',
      main: 'board-with-lists.js',
      schema: {
        type: 'object',
        properties: {
          sponsors: {
            type: 'array',
            title: 'Patrocinadores',
            items: { type: 'object', required: ['name', 'level', 'logoUrl'] },
          },
          slots: {
            type: 'array',
            title: 'Sessões',
            items: { type: 'object', required: ['slotId', 'sessionName', 'startsAtMs'] },
          },
        },
        required,
      },
    },
    defaultLayerId: 'fullscreen',
    category: 'other',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The organiser listed before Bosch, and the enduro before the briefing. */
function buildLibraryOfSunday(): EntityLibrary {
  return {
    ...buildEmptyLibrary(),
    sponsors: [
      {
        sponsorId: 'sae',
        name: 'SAE Brasil',
        tier: 'realizacao',
        rollWeight: 5,
        logoMediaId: saeLogoMediaId,
      },
      {
        sponsorId: 'bosch',
        name: 'Bosch',
        tier: 'diamante',
        rollWeight: 10,
        logoMediaId: boschLogoMediaId,
        logoOnLightPlate: true,
      },
    ],
    scheduleSlots: [
      {
        slotId: 'enduro',
        sessionName: 'Enduro de Resistência',
        sessionKind: 'enduro',
        startsAtMs: Date.parse('2025-03-30T13:00:00.000Z'),
      },
      {
        slotId: 'briefing',
        sessionName: 'Briefing das equipes',
        sessionKind: 'other',
        startsAtMs: Date.parse('2025-03-30T11:30:00.000Z'),
      },
    ],
  };
}

/** The board's two lists, read from Cadastros. */
function buildFieldsReadingBothLists(): ItemFields {
  return {
    sponsors: { kind: 'entityList', entityType: 'sponsor' },
    slots: { kind: 'entityList', entityType: 'scheduleSlot' },
  };
}

describe('resolveItemFieldsIntoGraphicData with entity lists', () => {
  it('reads every sponsor in round order and every slot by start at the take', () => {
    // Arrange: the board reading both lists, and Sunday's library.
    const fields = buildFieldsReadingBothLists();

    // Act: resolve it at the take.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildBoardWithListsGraphic(['sponsors', 'slots']),
      momentOfTheTake,
      sources: buildSourcesAtLap34([]),
      entities: buildLibraryOfSunday(),
    });

    // Assert: Bosch before the organiser, the briefing before the enduro.
    expect(resolution, 'both lists filled from Cadastros').toEqual({
      status: 'resolved',
      data: {
        sponsors: [
          {
            name: 'Bosch',
            level: 'diamante',
            logoUrl: `/media/${boschLogoMediaId}`,
            logoOnLightPlate: true,
            rollWeight: 10,
          },
          {
            name: 'SAE Brasil',
            level: 'realizacao',
            logoUrl: `/media/${saeLogoMediaId}`,
            logoOnLightPlate: false,
            rollWeight: 5,
          },
        ],
        slots: [
          {
            slotId: 'briefing',
            sessionName: 'Briefing das equipes',
            sessionKind: 'other',
            startsAtMs: Date.parse('2025-03-30T11:30:00.000Z'),
          },
          {
            slotId: 'enduro',
            sessionName: 'Enduro de Resistência',
            sessionKind: 'enduro',
            startsAtMs: Date.parse('2025-03-30T13:00:00.000Z'),
          },
        ],
      },
    });
  });

  it('refuses the take when a required list is empty, naming the field in pt-BR', () => {
    // Arrange: the sponsor list required, and no sponsor in Cadastros.
    const fields = { sponsors: { kind: 'entityList', entityType: 'sponsor' } } as const;

    // Act: resolve it at the take.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildBoardWithListsGraphic(['sponsors']),
      momentOfTheTake,
      sources: buildSourcesAtLap34([]),
      entities: buildEmptyLibrary(),
    });

    // Assert: refused, the field's title before the reason.
    expect(resolution, 'a roll cannot go on air with no sponsor').toEqual({
      status: 'refused',
      error: {
        code: 'ENTITY_NOT_RESOLVED',
        message: 'Patrocinadores: nenhum patrocinador com logo nos cadastros.',
      },
    });
  });

  it('leaves an optional list out when it is empty', () => {
    // Arrange: the sponsors optional (the intermission's sponsor line), none in Cadastros;
    // the slots there as usual.
    const fields = buildFieldsReadingBothLists();
    const library = { ...buildLibraryOfSunday(), sponsors: [] };

    // Act: resolve it at the take.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildBoardWithListsGraphic(['slots']),
      momentOfTheTake,
      sources: buildSourcesAtLap34([]),
      entities: library,
    });

    // Assert: no sponsors key at all; the slots are there.
    const data = resolution.status === 'resolved' ? resolution.data : {};
    expect(Object.keys(data), 'an empty optional list is left out of the data').toEqual(['slots']);
  });
});

describe('findRefusalOfEntityFieldsForGraphic with entity lists', () => {
  it('refuses the schedule saved on the sponsors’ field, naming the field and the list', () => {
    // Arrange: an item that reads every slot into the sponsor list.
    const fields: ItemFields = { sponsors: { kind: 'entityList', entityType: 'scheduleSlot' } };

    // Act: run the save check.
    const refusal = findRefusalOfEntityFieldsForGraphic(
      buildBoardWithListsGraphic([]),
      fields,
      buildLibraryOfSunday(),
    );

    // Assert: refused while preparing the show, not at the take.
    expect(refusal, 'a list must fit its field to be saved').toEqual({
      code: 'INVALID_ENTITY_REFERENCE',
      message:
        'Patrocinadores: a lista de sessões da programação dos cadastros não serve para este campo.',
    });
  });

  it('saves every sponsor on the sponsors’ field, even before any sponsor is typed', () => {
    // Arrange: the roll prepared the evening before, Cadastros still empty.
    const fields: ItemFields = { sponsors: { kind: 'entityList', entityType: 'sponsor' } };

    // Act: run the save check.
    const refusal = findRefusalOfEntityFieldsForGraphic(
      buildBoardWithListsGraphic(['sponsors']),
      fields,
      buildEmptyLibrary(),
    );

    // Assert: accepted; whether the list has records is judged at the take.
    expect(refusal, 'an empty library must not stop the save').toBeUndefined();
  });
});
