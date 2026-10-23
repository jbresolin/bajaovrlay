/**
 * The item editor and fields filled by an event (apps/control)
 *
 * What this module is for:
 *   BAJAOVRLAY-44 lets an item field be filled by the event the item shows: the notice's
 *   car, team or reason come from a penalty or a fastest lap, never typed. The item
 *   editor's per-field kind selector gains "Evento" wherever some field of an event's
 *   payload fits the field (by the same type rule as "Fonte"), and choosing it shows a
 *   dropdown of those payload fields only. Such an item is a template: the server takes it
 *   only through an event.
 *
 * What these tests prove:
 *   - "Evento" is offered on the race clock's title (a text), with the six text fields of
 *     an event and no number; it is not offered on the running switch (no payload field
 *     is a yes or no).
 *   - Saving stores the title as an event field reading the team.
 *   - Saving "Evento" with no payload field chosen is refused on the page, naming the
 *     field, and nothing is sent.
 *   - A stored item opens with its event field chosen.
 *
 * What these tests deliberately do not cover:
 *   - Which payload fields fit which graphic fields, row by row; eventFieldValue.test.ts
 *     in packages/shared.
 *   - The server's check of the save and its take of a template;
 *     eventFieldsOnTheStore.test.ts in apps/server.
 */
import type { Item } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  pressSaveAndWaitForCommand,
  renderItemEditorPanelForNewRaceClockItem,
  renderItemEditorPanelOnFakeServerWithSlices,
  waitForThePageToDealWithTheLastAnswer,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildEnduranceStartClockItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from './itemsLikeTheEditorSaves.testSupport';

/** The options a dropdown offers, by its accessible name, as the operator reads them. */
function readOptionsOfDropdown(dropdownName: string): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  const optionNames = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getAllByRole('option')[0] ?? document.body, { key: 'Escape' });
  return optionNames;
}

/** The race clock item of the enduro start, its title filled by the event's team. */
function buildClockItemWhoseTitleReadsTheEvent(): Item {
  const item = buildEnduranceStartClockItem();
  return {
    ...item,
    label: 'Relógio — aviso de evento',
    fields: { ...item.fields, sessionName: { kind: 'eventField', path: 'teamName' } },
  };
}

describe('"Evento" in the kind selector of the item editor', () => {
  it("offers it on the title, with the event's text fields only", () => {
    // Arrange: a new race clock item.
    renderItemEditorPanelForNewRaceClockItem();

    // Act: read the kinds of the title, choose "Evento", read what it may read.
    const kindsOfTheTitle = readOptionsOfDropdown('Como preencher Título');
    chooseOptionInDropdown('Como preencher Título', 'Evento');
    const payloadFieldsOffered = readOptionsOfDropdown('O que Título lê do evento');

    // Assert: "Evento" is among the kinds, and only the six text fields are offered.
    expect(kindsOfTheTitle, 'a text field may be filled by an event').toContain('Evento');
    expect(payloadFieldsOffered, 'only the text fields of an event fit a text').toEqual([
      'Equipe',
      'Escola',
      'Tipo de aviso',
      'Motivo',
      'Punição',
      'Tempo da volta (texto)',
    ]);
  });

  it('does not offer it on the running switch', () => {
    // Arrange: a new race clock item.
    renderItemEditorPanelForNewRaceClockItem();

    // Act: read the kinds of the running switch.
    const kindsOfTheSwitch = readOptionsOfDropdown('Como preencher Relógio correndo');

    // Assert: no "Evento": no field of an event is a yes or a no.
    expect(kindsOfTheSwitch, 'nothing in an event fills a switch').not.toContain('Evento');
  });

  it("saves the title as filled by the event's team", async () => {
    // Arrange: a new race clock item whose title reads the event's team.
    const { fakeServer } = renderItemEditorPanelForNewRaceClockItem();
    typeIntoField('Rótulo', 'Relógio — aviso de evento');
    chooseOptionInDropdown('Como preencher Título', 'Evento');
    chooseOptionInDropdown('O que Título lê do evento', 'Equipe');

    // Act: save.
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the title is stored as an event field reading the team.
    const createItem = fakeServer.listCommandsReceived()[0] as { fields: Record<string, unknown> };
    expect(createItem.fields.sessionName, "the title reads the event's team").toEqual({
      kind: 'eventField',
      path: 'teamName',
    });
  });

  it('refuses to save "Evento" with nothing chosen, naming the field', async () => {
    // Arrange: a new race clock item whose title is set to "Evento" and nothing more.
    const { fakeServer } = renderItemEditorPanelForNewRaceClockItem();
    typeIntoField('Rótulo', 'Relógio — aviso de evento');
    chooseOptionInDropdown('Como preencher Título', 'Evento');

    // Act: press "Salvar item".
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    await waitForThePageToDealWithTheLastAnswer();

    // Assert: the message under the title, and no command sent.
    expect(
      screen.getByText('Escolha o que "Título" lê do evento.'),
      'the page must say what is missing',
    ).toBeTruthy();
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });

  it('opens a stored item with its event field chosen', () => {
    // Arrange: the server holds the clock whose title reads the event's team.
    const item = buildClockItemWhoseTitleReadsTheEvent();

    // Act: open it in the editor.
    renderItemEditorPanelOnFakeServerWithSlices(item, {
      ...buildSlicesWithTheRaceClockAndTheLowerThird(),
      items: [item],
    });

    // Assert: the title shows "Evento" and the team.
    expect(
      screen.getByRole('combobox', { name: 'Como preencher Título' }).textContent,
      'the title is filled by an event',
    ).toBe('Evento');
    expect(
      screen.getByRole('combobox', { name: 'O que Título lê do evento' }).textContent,
      "it reads the event's team",
    ).toBe('Equipe');
  });
});
