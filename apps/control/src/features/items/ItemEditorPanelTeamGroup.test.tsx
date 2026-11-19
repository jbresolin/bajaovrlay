/**
 * One team pick fills the team card (apps/control)
 *
 * What this module is for:
 *   The team card's eight fields (number, team, school, city, state, car photo, logo and
 *   the logo's light plate) all come from the team's record in Cadastros, and the operator
 *   used to pick the same team once per field. BAJAOVRLAY-80 declares them one group,
 *   "Equipe", whose picker is filled from Cadastros and searched by number or name. One
 *   pick writes every field as the ordinary per-field reference to that team, so a later
 *   edit in Cadastros reaches the card as it always did.
 *
 * What these tests prove (the team card's real manifest; teams 42 and 7 in Cadastros):
 *   - A new team card opens straight on the team picker; finding team 42 by its number
 *     and picking it saves the eight fields as references to team 42's own attributes.
 *   - Picking team 7 after team 42 moves every field to team 7.
 *   - The picker says what each field reads now (the team's name, its city).
 *   - A card saved field by field on team 42 opens grouped, showing team 42; one whose
 *     logo reads team 7 opens with "Campos separados" on and every field in its own row.
 *   - A field can still be detached and typed by hand: "Campos separados", then the
 *     city typed, saves the typed city beside the other seven references.
 *   - Saving with no team chosen is refused with a message tied to the team picker.
 *
 * What these tests deliberately do not cover:
 *   - Which fields agree on one team, rule by rule; carGroupTeamRecord.test.ts.
 *   - Resolving a reference at the take; resolveItemFieldsWithEntities tests on the
 *     server, unchanged by this work. The card on air: e2e/lowerThirdTeamCardStandingsWalk.
 */
import type { EntityFieldValue, Graphic, Item, ItemFields, Slices } from '@bajaovrlay/shared';
import teamCardManifest from '@bajaovrlay/team-card/team-card.ograf.json';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  flipSwitch,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  buildSlicesWithTheLibrary,
  buildTeam7,
  buildTeam42WithItsLogo,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import {
  chooseGraphicInTheEditor,
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';
import { idOfTheMainSessionRundown } from './itemsLikeTheEditorSaves.testSupport';

/** The team card, as the editor's "Gráfico" dropdown names it (its manifest's name). */
const teamCardGraphicName = 'Cartão de equipe';

/** The team card as the server registers it once its package is built. */
function buildTeamCardGraphic(): Graphic {
  return {
    id: 'team-card',
    manifest: structuredClone(teamCardManifest),
    defaultLayerId: 'lower-third',
    category: 'team',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** What the server sends: the team card, and teams 42 and 7 in Cadastros. */
function buildSlicesWithTheTeamCardAndTwoTeams(items: Item[]): Slices {
  return {
    ...buildSlicesWithTheLibrary({ teams: [buildTeam42WithItsLogo(), buildTeam7()] }),
    graphics: [buildTeamCardGraphic()],
    items,
  };
}

/** One attribute of the team of this car in Cadastros, as a saved field holds it. */
function buildTeamReference(carNumber: number, attribute: string): EntityFieldValue {
  return { kind: 'entity', entityType: 'team', carNumber, attribute };
}

/** The eight fields of the card, each reading its own attribute of the team of this car. */
function buildFieldsReadingTeam(carNumber: number): ItemFields {
  return {
    carNumber: buildTeamReference(carNumber, 'carNumber'),
    teamName: buildTeamReference(carNumber, 'teamName'),
    schoolName: buildTeamReference(carNumber, 'schoolName'),
    city: buildTeamReference(carNumber, 'city'),
    state: buildTeamReference(carNumber, 'state'),
    carPhotoUrl: buildTeamReference(carNumber, 'carPhotoUrl'),
    logoUrl: buildTeamReference(carNumber, 'logoUrl'),
    logoOnLightPlate: buildTeamReference(carNumber, 'logoOnLightPlate'),
  };
}

/** "Cartão — Baja UFPR", a team card saved with these fields. */
function buildSavedTeamCardItem(fields: ItemFields): Item {
  return {
    id: '5b1e7c42-9d3a-4e60-8f21-c7a4b9d0e316',
    home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
    order: 0,
    graphicId: 'team-card',
    layerId: 'lower-third',
    fields,
    label: 'Cartão — Baja UFPR',
    color: 'neutral',
    notes: '',
  };
}

/** The editor for a new team card item. */
function renderNewTeamCardItemEditor() {
  const editorOnFakeServer = renderItemEditorPanelOnFakeServerWithSlices(
    null,
    buildSlicesWithTheTeamCardAndTwoTeams([]),
  );
  chooseGraphicInTheEditor(teamCardGraphicName);
  typeIntoField('Rótulo', 'Cartão — escolhido uma vez');
  return editorOnFakeServer;
}

/** The editor opened on a saved team card item. */
function renderEditorOnSavedTeamCard(item: Item) {
  return renderItemEditorPanelOnFakeServerWithSlices(
    item,
    buildSlicesWithTheTeamCardAndTwoTeams([item]),
  );
}

/** Finds a team by what the operator types in the search box, then picks it. */
function pickTeam(searchText: string, teamShownInTheList: string): void {
  typeIntoField('Buscar equipe — Equipe', searchText);
  chooseOptionInDropdown('Equipe dos Cadastros — Equipe', teamShownInTheList);
}

/** The fields of the first command the fake server received. */
function readFieldsOfTheFirstCommand(
  fakeServer: ReturnType<typeof renderNewTeamCardItemEditor>['fakeServer'],
): Record<string, unknown> {
  return (fakeServer.listCommandsReceived()[0] as { fields: Record<string, unknown> }).fields;
}

describe('the team picker of a new team card', () => {
  it('fills all eight fields with team 42 found by its number and picked once', async () => {
    // Arrange: a new team card.
    const { fakeServer } = renderNewTeamCardItemEditor();

    // Act: find team 42 by its number, pick it, and save.
    pickTeam('42', 'Equipe 42 (Baja UFPR)');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: every field reads its own attribute of team 42, as eight picks would have.
    expect(
      readFieldsOfTheFirstCommand(fakeServer),
      'one pick must save the eight per-field references to team 42',
    ).toEqual(buildFieldsReadingTeam(42));
  });

  it('moves every field to team 7 when the pick changes', async () => {
    // Arrange: a new team card with team 42 picked.
    const { fakeServer } = renderNewTeamCardItemEditor();
    pickTeam('42', 'Equipe 42 (Baja UFPR)');

    // Act: find team 7 by its team's name instead, pick it, and save.
    pickTeam('Juriti', 'Equipe 7 (Juriti Off-Road)');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: all eight fields now read team 7.
    expect(readFieldsOfTheFirstCommand(fakeServer), 'no field may stay on team 42').toEqual(
      buildFieldsReadingTeam(7),
    );
  });

  it('shows what the fields read now from the team picked', () => {
    // Arrange: a new team card.
    renderNewTeamCardItemEditor();

    // Act: pick team 7.
    pickTeam('7', 'Equipe 7 (Juriti Off-Road)');

    // Assert: its name and its city are listed under the picker.
    expect(screen.getByText('Valor agora: Juriti Off-Road'), "the team's name").toBeVisible();
    expect(screen.getByText('Valor agora: Joinville'), "the team's city").toBeVisible();
  });

  it('refuses to save with no team chosen, the message tied to the team picker', async () => {
    // Arrange: a new team card with nothing picked.
    const { fakeServer } = renderNewTeamCardItemEditor();

    // Act: try to save.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    const message = await screen.findByRole('alert');

    // Assert: the message asks for the team, the picker is invalid and described by it.
    const teamPicker = screen.getByRole('combobox', { name: 'Equipe dos Cadastros — Equipe' });
    expect(message, 'the message says to choose the team').toHaveTextContent(
      'Escolha a equipe de Equipe nos Cadastros.',
    );
    expect(teamPicker, 'the team picker is marked invalid').toHaveAttribute('aria-invalid', 'true');
    expect(fakeServer.listCommandsReceived(), 'nothing is saved').toEqual([]);
  });
});

describe('a team card saved before', () => {
  it('opens grouped on team 42 when every field reads team 42', () => {
    // Arrange: a card saved field by field, every field on team 42.
    const savedItem = buildSavedTeamCardItem(buildFieldsReadingTeam(42));

    // Act: open it in the editor.
    renderEditorOnSavedTeamCard(savedItem);

    // Assert: one team picker showing team 42, and no field edited on its own.
    expect(
      screen.getByRole('combobox', { name: 'Equipe dos Cadastros — Equipe' }),
      'the group shows team 42',
    ).toHaveTextContent('Equipe 42 (Baja UFPR)');
    expect(
      screen.queryByRole('combobox', { name: 'Como preencher Cidade' }),
      'no field of the grouped team is edited one by one',
    ).toBeNull();
  });

  it('opens with "Campos separados" on when the logo reads another team', () => {
    // Arrange: a card on team 42 whose logo reads team 7.
    const savedItem = buildSavedTeamCardItem({
      ...buildFieldsReadingTeam(42),
      logoUrl: buildTeamReference(7, 'logoUrl'),
    });

    // Act: open it in the editor.
    renderEditorOnSavedTeamCard(savedItem);

    // Assert: split, with every field in its own row, so the mix is never hidden.
    expect(
      screen.getByRole('switch', { name: 'Campos separados — Equipe' }),
      'the team opens with its fields separate',
    ).toBeChecked();
    expect(
      screen.getByRole('combobox', { name: 'Como preencher Logo da equipe' }),
      'the logo is edited in its own row',
    ).toBeVisible();
  });
});

describe('detaching a field from the team', () => {
  it('saves the city typed by hand beside the seven fields that still read team 42', async () => {
    // Arrange: a card saved on team 42, open in the editor.
    const savedItem = buildSavedTeamCardItem(buildFieldsReadingTeam(42));
    const { fakeServer } = renderEditorOnSavedTeamCard(savedItem);

    // Act: show the fields one by one, type the city by hand, and save.
    flipSwitch('Campos separados — Equipe');
    chooseOptionInDropdown('Como preencher Cidade', 'Valor digitado');
    typeIntoField('Cidade', 'São José dos Pinhais');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: only the city changes, now typed; the other seven keep reading team 42.
    expect(fakeServer.listCommandsReceived()[0], 'only the city is saved, typed').toEqual({
      type: 'updateItemFields',
      itemId: savedItem.id,
      fields: { city: { kind: 'literal', value: 'São José dos Pinhais' } },
    });
  });
});
