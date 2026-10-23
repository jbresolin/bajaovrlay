/**
 * Which images "Limpar imagens sem uso" deletes (apps/control)
 *
 * What this module is for:
 *   The Cadastros page offers to clean the media store of images nothing uses
 *   (BAJAOVRLAY-19). Nothing must mean nothing (gate 2 of PR #23): no team, person or
 *   sponsor names it, no item holds its address as a typed value, and no instance on air
 *   or in preview shows it. The page asks the same shared question the server asks
 *   before deleting, so the button never offers what the server would refuse.
 *
 * What these tests prove:
 *   - An image no record, item or instance uses is listed.
 *   - An image only an item holds, and one only shown on air, are not.
 *
 * What these tests deliberately do not cover:
 *   - The button; EntityLibraryPage.test.tsx.
 */
import { buildMediaUrl, type Instance, type Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildLogoOfTeam42,
  buildTeam42WithItsLogo,
  buildUnusedCarPhoto,
  unusedCarPhotoMediaId,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { listUnusedMediaIds } from './mediaUsage';

/** An item whose logo field holds the old car photo, typed with the image picker. */
function buildItemHoldingTheOldPhoto(): Item {
  return {
    id: 'item-cartao-antigo',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'team-card',
    layerId: 'lower-third',
    fields: { logo: { kind: 'literal', value: buildMediaUrl(unusedCarPhotoMediaId) } },
    label: 'Cartão antigo',
    color: 'neutral',
    notes: '',
  };
}

/** A card on air showing the old car photo. */
function buildCardOnAirShowingTheOldPhoto(): Instance {
  return {
    id: 'instancia-cartao',
    layerId: 'lower-third',
    graphicId: 'team-card',
    target: 'program',
    resolvedData: { logo: buildMediaUrl(unusedCarPhotoMediaId) },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-11-14T13:40:00.000Z',
  };
}

describe('listUnusedMediaIds', () => {
  const scenarios = [
    // Nothing uses the old photo: it is offered for cleaning.
    {
      name: 'lists an image nothing uses',
      items: [],
      instances: [],
      expected: [unusedCarPhotoMediaId],
    },
    // The image picker stored its address in an item.
    {
      name: 'keeps an image an item holds',
      items: [buildItemHoldingTheOldPhoto()],
      instances: [],
      expected: [],
    },
    // It is on air: rule 4, nothing on air loses its image.
    {
      name: 'keeps an image shown on air',
      items: [],
      instances: [buildCardOnAirShowingTheOldPhoto()],
      expected: [],
    },
  ];

  it.each(scenarios)('$name', ({ items, instances, expected }) => {
    // Arrange: team 42 with its logo, the old photo, and the items and instances of the row.
    const places = {
      teams: [buildTeam42WithItsLogo()],
      people: [],
      sponsors: [],
      scheduleSlots: [],
      items,
      instances,
    };

    // Act: list the images that may be cleaned.
    const unusedMediaIds = listUnusedMediaIds([buildLogoOfTeam42(), buildUnusedCarPhoto()], places);

    // Assert: exactly these.
    expect(unusedMediaIds, 'the images that may be cleaned').toEqual(expected);
  });
});
