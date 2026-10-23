/**
 * The item editor and fields read from the entity library (apps/control)
 *
 * What this module is for:
 *   BAJAOVRLAY-19 lets an item field read one attribute of one record of the entity
 *   library: the race clock's title, for instance, can be "the team name of car 7". The
 *   item editor hands its generated form the library the server holds, so "Cadastro" is
 *   offered and its "Valor agora" reads the records on the page; saving stores the
 *   reference, never the name.
 *
 * What these tests prove:
 *   - With team 7 in the library, the race clock's title set to "Cadastro" › Equipe ›
 *     car 7 › "Nome da equipe" shows "Valor agora: Juriti Off-Road".
 *   - Saving sends createItem with the title stored as the entity reference.
 *
 * What these tests deliberately do not cover:
 *   - Each control of "Cadastro"; SchemaFormFieldsEntityReference.test.tsx.
 *   - The server's check of the save; itemEntityFields.test.ts in apps/server.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { buildTeam7 } from '@/state/entitiesLikeTheServerSends.testSupport';

import {
  chooseGraphicInTheEditor,
  pressSaveAndWaitForCommand,
  raceClockGraphicName,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';
import { buildSlicesWithTheRaceClockAndTheLowerThird } from './itemsLikeTheEditorSaves.testSupport';

/** The editor for a new race clock item, on a page whose library holds team 7. */
function renderNewClockItemEditorWithTeam7() {
  const editorOnFakeServer = renderItemEditorPanelOnFakeServerWithSlices(null, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    teams: [buildTeam7()],
  });
  chooseGraphicInTheEditor(raceClockGraphicName);
  return editorOnFakeServer;
}

/** Sets the clock's title to read car 7's team name. */
function readTheTitleFromTeam7(): void {
  chooseOptionInDropdown('Como preencher Título', 'Cadastro');
  chooseOptionInDropdown('Tipo de cadastro de Título', 'Equipe');
  fireEvent.change(screen.getByLabelText('Buscar cadastro de Título'), { target: { value: '7' } });
  chooseOptionInDropdown('Cadastro de Título', 'Equipe 7 (Juriti Off-Road)');
  chooseOptionInDropdown('Campo do cadastro de Título', 'Nome da equipe');
}

describe('the "Cadastro" kind in the item editor', () => {
  it("shows car 7's team name as the title's value now", () => {
    // Arrange: a new race clock item, team 7 in the library.
    renderNewClockItemEditorWithTeam7();

    // Act: read the title from team 7.
    readTheTitleFromTeam7();

    // Assert: the name the take would put on air now.
    expect(screen.getByText('Valor agora: Juriti Off-Road'), 'the value now').toBeVisible();
  });

  it("saves the title as the reference to car 7's team name", async () => {
    // Arrange: the title read from team 7, a label typed.
    const { fakeServer } = renderNewClockItemEditorWithTeam7();
    typeIntoField('Rótulo', 'Relógio — equipe 7');
    readTheTitleFromTeam7();

    // Act: save.
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the title is stored as the reference, not as the name.
    const createItem = fakeServer.listCommandsReceived()[0] as { fields: Record<string, unknown> };
    expect(createItem.fields.sessionName, 'the reference as chosen').toEqual({
      kind: 'entity',
      entityType: 'team',
      carNumber: 7,
      attribute: 'teamName',
    });
  });
});
