/**
 * The marker of an item that reads the entity library (apps/control)
 *
 * What this module is for:
 *   A rundown row or a shortcut button of an item whose fields read the entity library
 *   (BAJAOVRLAY-19) carries the marker "cadastro", or "cadastro · não entra agora" when a
 *   take would be refused right now (the team was deleted in Cadastros), the reason in
 *   its tooltip and read out with it, so the operator knows before pressing. The reason
 *   is the server's own sentence, the field's title first.
 *
 * What these tests prove:
 *   - An item whose title reads car 7's team shows "cadastro" while team 7 is stored.
 *   - With team 7 deleted it shows "cadastro · não entra agora", naming the field and
 *     the car.
 *   - An item that reads nothing of the library shows no marker.
 *
 * What these tests deliberately do not cover:
 *   - The marker of a source; ItemSourceMarker.test.tsx.
 */
import type { Item } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithTheLibrary,
  buildTeam7,
} from '@/state/entitiesLikeTheServerSends.testSupport';
import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import { ItemEntityMarker } from './ItemEntityMarker';

/** The race clock item whose title reads the name of car 7's team. */
function buildClockItemReadingTeam7(): Item {
  return {
    id: 'item-relogio-equipe-7',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'entity', entityType: 'team', carNumber: 7, attribute: 'teamName' },
    },
    label: 'Relógio — equipe 7',
    color: 'neutral',
    notes: '',
  };
}

describe('ItemEntityMarker', () => {
  it('says "cadastro" while the team is stored', () => {
    // Arrange: team 7 in the library.
    renderOnControlPageConnectedToFakeServer(
      <ItemEntityMarker item={buildClockItemReadingTeam7()} />,
      {
        ...buildSlicesWithTheLibrary({ teams: [buildTeam7()] }),
        graphics: [buildRaceClockGraphic()],
      },
    );

    // Act: nothing; read the marker.
    const marker = screen.getByText('cadastro');

    // Assert: the plain marker.
    expect(marker, 'the item reads the library').toBeInTheDocument();
  });

  it('says it cannot be taken now once the team is deleted, naming field and car', () => {
    // Arrange: an empty library (team 7 deleted).
    renderOnControlPageConnectedToFakeServer(
      <ItemEntityMarker item={buildClockItemReadingTeam7()} />,
      { ...buildSlicesWithTheLibrary({}), graphics: [buildRaceClockGraphic()] },
    );

    // Act: nothing; read the marker.
    const marker = screen.getByText('cadastro · não entra agora');

    // Assert: the warning, its reason read out with it.
    expect(marker, 'the take would be refused').toHaveAccessibleName(
      'Não entra no ar agora: Título: a equipe do carro 7 não está nos cadastros.',
    );
  });

  it('shows nothing for an item that reads nothing of the library', () => {
    // Arrange: an item with a typed title.
    const typedItem: Item = {
      ...buildClockItemReadingTeam7(),
      fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência' } },
    };
    renderOnControlPageConnectedToFakeServer(
      <ItemEntityMarker item={typedItem} />,
      buildSlicesWithTheLibrary({}),
    );

    // Act: nothing; look for a marker.
    const marker = screen.queryByText(/cadastro/);

    // Assert: none.
    expect(marker, 'no marker').not.toBeInTheDocument();
  });
});
