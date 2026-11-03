/**
 * "Gatilhos": the triggers on the "Eventos" page (apps/control)
 *
 * What this module is for:
 *   A trigger (BAJAOVRLAY-48) runs a macro when something outside the operator's hands
 *   happens: an OBS scene entered or left, an HTTP call, an inbox event, a time of the
 *   schedule. "Gatilhos", beside "Regras" on the "Eventos" page, lists the triggers and
 *   edits one: its kind and filter, its macro, its mode, its minimum interval and on/off.
 *   "Salvar gatilho" sends createTrigger or updateTrigger; "Excluir gatilho", pressed twice,
 *   deleteTrigger. An HTTP trigger shows the address to copy and a `curl` example.
 *
 * What these tests prove:
 *   - The list shows each trigger's name, what it waits for in words, its macro, mode,
 *     interval and whether it is on.
 *   - Each of the four kinds is created as the operator fills it in.
 *   - A stored HTTP trigger shows its address on this server and a curl with a body; a new
 *     one says the address comes after saving.
 *   - A stored trigger switched off and set to "Automático" saves as the whole trigger.
 *   - "Excluir gatilho" asks once more, then sends deleteTrigger.
 *   - A trigger with no name is refused on the page, sending nothing.
 *
 * What these tests deliberately do not cover:
 *   - Every value the editor reads, which triggerForm.test.ts tables.
 *   - What the server does with the commands; apps/server's modules/triggers tests.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EventReviewPage } from '@/features/events/EventReviewPage';
import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  closeTheSessionMacroId,
  openTheSessionMacroId,
} from '@/state/quickFireLikeTheServerSends.testSupport';
import {
  boxEnteredTriggerId,
  buildSlicesWithTheTriggers,
  deskButtonTriggerId,
  enduroSlotId,
} from '@/state/triggersLikeTheServerSends.testSupport';

/** The "Eventos" page with "Gatilhos" open. */
function openTheTriggers() {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <EventReviewPage />,
    buildSlicesWithTheTriggers(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Gatilhos' }));
  return controlPage;
}

/** Opens the editor of a new trigger and gives it a name and a macro. */
function startANewTrigger(name: string, macroLabel: string): void {
  fireEvent.click(screen.getByRole('button', { name: '+ Gatilho' }));
  fireEvent.change(screen.getByLabelText('Nome do gatilho'), { target: { value: name } });
  chooseOptionInDropdown('Macro', macroLabel);
}

/** Types into a text field found by its label. */
function typeInto(fieldLabel: string, text: string): void {
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value: text } });
}

describe('the list of triggers', () => {
  it('shows each trigger with what it waits for, its macro, mode, interval and on/off', () => {
    // Arrange: the two triggers of race day.
    openTheTriggers();

    // Act: read the list's rows.
    const rows = within(screen.getByRole('list', { name: 'Lista de gatilhos' })).getAllByRole(
      'listitem',
    );

    // Assert: each row says it all in words.
    expect(
      rows.map((row) => row.textContent),
      'the rows must say what each trigger does',
    ).toEqual([
      expect.stringContaining('Entrou no box') as unknown as string,
      expect.stringContaining('Botão da mesa') as unknown as string,
    ]);
    expect(rows[0]?.textContent, 'the scene trigger in words').toContain(
      'Entrou na cena "Box" → Abrir a sessão · Automático · a cada 10 s no mínimo · Ligado',
    );
    expect(rows[1]?.textContent, 'the HTTP trigger in words').toContain(
      'Chamada HTTP → Fechar a sessão · Perguntar · a cada 30 s no mínimo · Ligado',
    );
  });
});

describe('creating a trigger', () => {
  const kindsFilledIn = [
    // The brief's first example: a scene entered.
    {
      name: 'a scene entered',
      fillTheKind: () => {
        typeInto('Cena do OBS', 'Box');
      },
      expectedWhen: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
    },
    // A D200 button's call.
    {
      name: 'an HTTP call',
      fillTheKind: () => {
        chooseOptionInDropdown('Quando', 'Chamada HTTP');
      },
      expectedWhen: { kind: 'http' },
    },
    // A penalty recorded in the inbox.
    {
      name: 'a penalty',
      fillTheKind: () => {
        chooseOptionInDropdown('Quando', 'Evento da caixa de entrada');
        chooseOptionInDropdown('Tipo de evento', 'Penalidade');
      },
      expectedWhen: { kind: 'dataEvent', eventKind: 'penalty' },
    },
    // Ten minutes before the Enduro, picked from Programação.
    {
      name: 'ten minutes before the Enduro',
      fillTheKind: () => {
        chooseOptionInDropdown('Quando', 'Horário');
        chooseOptionInDropdown('Sessão da programação', 'Enduro');
        typeInto('Minutos', '10');
      },
      expectedWhen: {
        kind: 'schedule',
        moment: { kind: 'slotStart', slotId: enduroSlotId, minutesFromStart: -10 },
      },
    },
  ];

  it.each(kindsFilledIn)('creates $name', ({ fillTheKind, expectedWhen }) => {
    // Arrange: a new trigger named "Novo gatilho" running "Abrir a sessão".
    const { fakeServer } = openTheTriggers();
    startANewTrigger('Novo gatilho', 'Abrir a sessão');
    fillTheKind();

    // Act: save it.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar gatilho' }));

    // Assert: one createTrigger, asking first, 10 s apart, with this kind.
    expect(fakeServer.listCommandsReceived(), 'the new trigger is sent whole').toEqual([
      {
        type: 'createTrigger',
        name: 'Novo gatilho',
        isEnabled: true,
        when: expectedWhen,
        macroId: openTheSessionMacroId,
        mode: 'ask',
        minimumIntervalMs: 10_000,
      },
    ]);
  });

  it('refuses a trigger with no name on the page, sending nothing', () => {
    // Arrange: a new scene trigger with a macro but no name.
    const { fakeServer } = openTheTriggers();
    startANewTrigger('', 'Abrir a sessão');
    typeInto('Cena do OBS', 'Box');

    // Act: save it.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar gatilho' }));

    // Assert: the reason shown, nothing sent.
    expect(screen.getByRole('alert').textContent, 'the page must say what is missing').toBe(
      'Informe o nome do gatilho.',
    );
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });
});

describe('an HTTP trigger’s address', () => {
  it('shows the address on this server and a curl with a body for a stored trigger', () => {
    // Arrange: the triggers, open.
    openTheTriggers();

    // Act: edit "Botão da mesa".
    fireEvent.click(screen.getByRole('button', { name: 'Editar Botão da mesa' }));

    // Assert: the address to copy, and a curl calling it with a name.
    const expectedAddress = `${window.location.origin}/api/v1/triggers/${deskButtonTriggerId}`;
    expect(
      screen.getByLabelText('Endereço do gatilho'),
      'the address must be this server’s, ending in the trigger’s id',
    ).toHaveValue(expectedAddress);
    expect(
      screen.getByLabelText('Exemplo com curl'),
      'the curl must post a flat JSON body to it',
    ).toHaveValue(
      `curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"nome": "Ana Souza"}' ${expectedAddress}`,
    );
  });

  it('says the address comes after saving for a new HTTP trigger', () => {
    // Arrange: a new trigger.
    openTheTriggers();
    startANewTrigger('Botão do intervalo', 'Fechar a sessão');

    // Act: make it an HTTP trigger.
    chooseOptionInDropdown('Quando', 'Chamada HTTP');

    // Assert: no address yet, and the page says when it comes.
    expect(
      screen.getByText('O endereço aparece depois de salvar o gatilho.'),
      'an unsaved trigger has no id, so no address',
    ).toBeInTheDocument();
  });
});

describe('a stored trigger', () => {
  it('saves as the whole trigger once switched off and set to "Automático"', () => {
    // Arrange: "Botão da mesa" open in the editor.
    const { fakeServer } = openTheTriggers();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Botão da mesa' }));

    // Act: switch it off, set it to run by itself, save.
    fireEvent.click(screen.getByRole('switch', { name: 'Gatilho ligado' }));
    chooseOptionInDropdown('Modo', 'Automático');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar gatilho' }));

    // Assert: one updateTrigger with everything, the two changes in it.
    expect(fakeServer.listCommandsReceived(), 'the whole trigger is sent').toEqual([
      {
        type: 'updateTrigger',
        triggerId: deskButtonTriggerId,
        name: 'Botão da mesa',
        isEnabled: false,
        when: { kind: 'http' },
        macroId: closeTheSessionMacroId,
        mode: 'auto',
        minimumIntervalMs: 30_000,
      },
    ]);
  });

  it('asks once more before deleting, then sends deleteTrigger', () => {
    // Arrange: "Entrou no box" open in the editor.
    const { fakeServer } = openTheTriggers();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Entrou no box' }));

    // Act: press "Excluir gatilho", then its confirmation.
    fireEvent.click(screen.getByRole('button', { name: 'Excluir gatilho' }));
    const commandsAfterTheFirstPress = [...fakeServer.listCommandsReceived()];
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: excluir gatilho' }));

    // Assert: nothing after the first press; deleteTrigger after the second.
    expect(commandsAfterTheFirstPress, 'one press must not delete').toEqual([]);
    expect(fakeServer.listCommandsReceived(), 'the confirmation deletes it').toEqual([
      { type: 'deleteTrigger', triggerId: boxEnteredTriggerId },
    ]);
  });
});
