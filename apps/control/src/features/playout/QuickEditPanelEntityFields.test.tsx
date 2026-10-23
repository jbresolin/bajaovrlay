/**
 * "Edição rápida" and fields that read the entity library (apps/control)
 *
 * What this module is for:
 *   An instance taken from an item that reads Cadastros has fields the server keeps up to
 *   date from the library (the entityFields of its entry in `instanceBindings`). Typing
 *   over one on air would stop it following the record, and the record would still say
 *   the old thing for the next take. Gate 2 of PR #23 draws such a field read-only, as a
 *   bound field is drawn: where it reads ("Cadastro › Equipe 42 › Número do carro"), the
 *   value on air, and "Editar no cadastro", which opens that record in Cadastros in a new
 *   browser tab, so the console stays where it is. The server still releases a field
 *   typed on air (a page older than this one could send it); that is its own test.
 *
 * What these tests prove:
 *   - The narrator's name and team 42's car number are read-only, each with where it
 *     reads and its value on air, while a typed field stays editable.
 *   - "Editar no cadastro" points at the record in Cadastros, in a new tab.
 *   - A field whose person was deleted says so in words, and offers no record to open.
 *   - "Atualizar" never sends a field that reads the library.
 *
 * What these tests deliberately do not cover:
 *   - Cadastros opening the record from its address; EntityLibraryPageOpensARecord.test.tsx.
 *   - The server releasing a field typed on air; liveRefreshEntities.test.ts in apps/server.
 */
import type { InstanceBindingsEntry, Person, Slices, Team } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { buildLowerThirdDataForCar42 } from '@/features/schemaForm/lowerThirdFixtureSchema.testSupport';
import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildNarrator, buildTeam42WithItsLogo } from '@/state/entitiesLikeTheServerSends.testSupport';
import {
  buildLowerThirdFixtureGraphic,
  buildLowerThirdFixtureInstanceOnProgram,
} from '@/state/lowerThirdFixtureGraphic.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
} from './operatingTheQuickEditPanel.testSupport';
import { QuickEditPanel } from './QuickEditPanel';

/** The id of the narrator's lower third on air. */
const idOfTheNarratorLowerThird = 'tarja-do-narrador';

/**
 * The narrator's lower third on air, taken from an item whose name reads the narrator's
 * record and whose car number reads team 42's.
 */
function buildSlicesWithTheNarratorLowerThirdOnAir(library: {
  people: Person[];
  teams: Team[];
}): Slices {
  const entry: InstanceBindingsEntry = {
    instanceId: idOfTheNarratorLowerThird,
    boundFields: [],
    entityFields: [
      {
        fieldKey: 'nome',
        entityReference: {
          kind: 'entity',
          entityType: 'person',
          personId: 'narrador-joao',
          attribute: 'name',
        },
      },
      {
        fieldKey: 'numeroDoCarro',
        entityReference: {
          kind: 'entity',
          entityType: 'team',
          carNumber: 42,
          attribute: 'carNumber',
        },
      },
    ],
  };
  return {
    ...buildSlicesWithNothingOnAir(),
    graphics: [buildLowerThirdFixtureGraphic()],
    instances: [
      buildLowerThirdFixtureInstanceOnProgram({
        id: idOfTheNarratorLowerThird,
        layerId: 'lower-third',
        resolvedData: { ...buildLowerThirdDataForCar42(), nome: 'João Bresolin' },
        takenAt: '2026-11-14T13:00:00.000Z',
      }),
    ],
    instanceBindings: [entry],
    people: library.people,
    teams: library.teams,
  };
}

/** Draws "Edição rápida" and "Camadas" with these slices, and loads the lower third. */
function loadTheNarratorLowerThirdIntoQuickEdit(slices: Slices) {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <>
      <QuickEditPanel />
      <LayerStatusPanel />
    </>,
    slices,
  );
  pressEditOnTheLayerRow('Tarja');
  return controlPage;
}

describe('the fields of an instance that read Cadastros, in "Edição rápida"', () => {
  it('shows the name and the car number read-only, with where they read and their value', () => {
    // Arrange and act: the narrator's lower third loaded with "Editar".
    loadTheNarratorLowerThirdIntoQuickEdit(
      buildSlicesWithTheNarratorLowerThirdOnAir({
        people: [buildNarrator()],
        teams: [buildTeam42WithItsLogo()],
      }),
    );

    // Assert: both say where they read, neither is a text box, the value on air shows, and
    // the typed role stays editable.
    expect(
      screen.getByText('Cadastro › João Bresolin › Nome'),
      'the name must say which record it reads',
    ).toBeVisible();
    expect(
      screen.getByText('Cadastro › Equipe 42 › Número do carro'),
      'the car number must say which record it reads',
    ).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Nome' }), 'the name cannot be typed').toBeNull();
    expect(
      screen.queryByRole('spinbutton', { name: 'Número do carro' }),
      'the car number cannot be typed',
    ).toBeNull();
    expect(screen.getByText('João Bresolin'), 'the name on air is shown').toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Cargo' }),
      'a typed field stays editable',
    ).toBeVisible();
  });

  it('points "Editar no cadastro" at the record in Cadastros, in a new tab', () => {
    // Arrange and act: the narrator's lower third loaded with "Editar".
    loadTheNarratorLowerThirdIntoQuickEdit(
      buildSlicesWithTheNarratorLowerThirdOnAir({
        people: [buildNarrator()],
        teams: [buildTeam42WithItsLogo()],
      }),
    );

    // Assert: each field's link opens its own record, away from the console.
    const nameLink = screen.getByRole('link', { name: 'Editar no cadastro: Nome' });
    const carNumberLink = screen.getByRole('link', { name: 'Editar no cadastro: Número do carro' });
    expect(nameLink, "the name opens the narrator's record").toHaveAttribute(
      'href',
      '#/cadastros/person/narrador-joao',
    );
    expect(carNumberLink, "the car number opens team 42's record").toHaveAttribute(
      'href',
      '#/cadastros/team/42',
    );
    expect(nameLink, 'Cadastros opens in a new tab, the console stays').toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('says in words that the person was deleted, and offers no record to open', () => {
    // Arrange and act: the lower third loaded after the narrator was deleted from Cadastros.
    loadTheNarratorLowerThirdIntoQuickEdit(
      buildSlicesWithTheNarratorLowerThirdOnAir({ people: [], teams: [buildTeam42WithItsLogo()] }),
    );

    // Assert: the words, never the id, and no link for the name.
    expect(
      screen.getByText('Cadastro › uma pessoa excluída dos cadastros › Nome'),
      'a deleted person is named in words',
    ).toBeVisible();
    expect(screen.queryByText(/narrador-joao/), 'the id is never shown').toBeNull();
    expect(
      screen.queryByRole('link', { name: 'Editar no cadastro: Nome' }),
      'there is no record to open',
    ).toBeNull();
  });

  it('never sends a field that reads Cadastros with "Atualizar"', async () => {
    // Arrange: the lower third loaded, and its typed role changed.
    const { fakeServer } = loadTheNarratorLowerThirdIntoQuickEdit(
      buildSlicesWithTheNarratorLowerThirdOnAir({
        people: [buildNarrator()],
        teams: [buildTeam42WithItsLogo()],
      }),
    );
    typeIntoField('Cargo', 'Narrador oficial');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the role alone.
    expect(fakeServer.listCommandsReceived(), 'only the typed field is sent').toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheNarratorLowerThird,
        data: { cargo: 'Narrador oficial' },
        takeTimeFieldKeys: [],
      },
    ]);
  });
});
