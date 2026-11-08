/**
 * What the Dados role sees on "Gatilhos" and "Regras" (apps/control)
 *
 * What this module is for:
 *   A trigger or an event rule in "Automático" puts things on air with nobody pressing a
 *   button, so with the PINs set it is the Produtor's (gate 2 of PR #51). Dados still
 *   prepares triggers and rules, in "Perguntar" or "Ignorar". As everywhere for Dados, what
 *   it may not use is greyed out, never hidden, with the server's sentence next to it.
 *
 * What these tests prove:
 *   - For Dados, "Automático" is offered greyed out in a trigger's and a rule's mode, with
 *     the sentence saying why; for the Produtor it can be chosen.
 *   - Editing an auto trigger, Dados finds its macro and what it waits for greyed out with
 *     the sentence, its name still editable; set back to "Perguntar", they open again.
 *   - On an auto rule, Dados finds its item and times greyed out with the sentence.
 *
 * What these tests deliberately do not cover:
 *   - The server's refusal of the same changes, row by row; apps/server's
 *     authorizeTriggerAutomationByTheDataRole.test.ts.
 *   - The editors themselves; TriggersDialog.test.tsx and EventRulesDialog.test.tsx.
 */
import type { SessionAnswer } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EventReviewPage } from '@/features/events/EventReviewPage';
import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheInbox } from '@/state/eventsLikeTheServerSends.testSupport';
import { buildSlicesWithTheTriggers } from '@/state/triggersLikeTheServerSends.testSupport';

const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-10-11T07:00:00.000Z' },
};
const producerAtMesa1: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'produtor', station: 'Mesa 1', expiresAt: '2026-10-11T07:00:00.000Z' },
};

const whyNotAnAutoTrigger =
  'O papel Dados não pode pôr um gatilho no automático. Peça ao Produtor.';
const whyNotChangingAnAutoTrigger =
  'O papel Dados não pode mexer num gatilho automático. Peça ao Produtor.';
const whyNotAnAutoRule = 'O papel Dados não pode pôr uma regra no automático. Peça ao Produtor.';
const whyNotChangingAnAutoRule =
  'O papel Dados não pode mexer numa regra automática. Peça ao Produtor.';

/** "Gatilhos" of race day ("Entrou no box" auto, "Botão da mesa" asking), for a session. */
function openTheTriggersAs(sessionAnswer: SessionAnswer): void {
  renderOnControlPageConnectedToFakeServer(<EventReviewPage />, buildSlicesWithTheTriggers(), {
    sessionAnswer,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Gatilhos' }));
}

/** "Regras" with João's defaults ("Volta mais rápida" auto, "Incidente" asking). */
function openTheRulesAs(sessionAnswer: SessionAnswer): void {
  renderOnControlPageConnectedToFakeServer(<EventReviewPage />, buildSlicesWithTheInbox([]), {
    sessionAnswer,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Regras' }));
}

/** Whether the option of an open dropdown is greyed out, by its name. */
function isOptionGreyedOut(dropdown: HTMLElement, optionName: string): boolean {
  fireEvent.keyDown(dropdown, { key: 'Enter' });
  const option = screen.getByRole('option', { name: optionName });
  const isGreyedOut = option.getAttribute('aria-disabled') === 'true';
  fireEvent.keyDown(option, { key: 'Escape' });
  return isGreyedOut;
}

describe('the mode of a trigger', () => {
  it('offers "Automático" greyed out to Dados, saying why, on a new trigger', () => {
    // Arrange: Dados on "Gatilhos".
    openTheTriggersAs(dataRoleAtMesa2);

    // Act: open a new trigger's editor.
    fireEvent.click(screen.getByRole('button', { name: '+ Gatilho' }));

    // Assert: the option is there, greyed out, and the sentence says why.
    expect(
      isOptionGreyedOut(screen.getByRole('combobox', { name: 'Modo' }), 'Automático'),
      'Dados may not set up a trigger that airs by itself',
    ).toBe(true);
    expect(screen.getByText(whyNotAnAutoTrigger), 'the reason is on screen').toBeTruthy();
  });

  it('offers "Automático" greyed out to Dados on a trigger that asks', () => {
    // Arrange: Dados on "Gatilhos".
    openTheTriggersAs(dataRoleAtMesa2);

    // Act: edit "Botão da mesa", which asks.
    fireEvent.click(screen.getByRole('button', { name: 'Editar Botão da mesa' }));

    // Assert: still not Dados's to set.
    expect(
      isOptionGreyedOut(screen.getByRole('combobox', { name: 'Modo' }), 'Automático'),
      'Dados may not switch a trigger to auto',
    ).toBe(true);
  });

  it('lets the Produtor choose "Automático"', () => {
    // Arrange: the Produtor on "Gatilhos".
    openTheTriggersAs(producerAtMesa1);

    // Act: open a new trigger's editor.
    fireEvent.click(screen.getByRole('button', { name: '+ Gatilho' }));

    // Assert: the option can be chosen, and no sentence for Dados shows.
    expect(
      isOptionGreyedOut(screen.getByRole('combobox', { name: 'Modo' }), 'Automático'),
      'the Produtor may automate',
    ).toBe(false);
    expect(screen.queryByText(whyNotAnAutoTrigger), 'nothing to explain').toBe(null);
  });
});

describe('an auto trigger edited by Dados', () => {
  it('greys out its macro and what it waits for, saying why, and leaves its name', () => {
    // Arrange: Dados on "Gatilhos".
    openTheTriggersAs(dataRoleAtMesa2);

    // Act: edit "Entrou no box", which is auto.
    fireEvent.click(screen.getByRole('button', { name: 'Editar Entrou no box' }));

    // Assert: macro and kind greyed out with the sentence; the name stays editable.
    const editor = within(screen.getByRole('region', { name: 'Editar gatilho: Entrou no box' }));
    expect(editor.getByRole('combobox', { name: 'Macro' }), 'its macro').toBeDisabled();
    expect(editor.getByRole('combobox', { name: 'Quando' }), 'its kind').toBeDisabled();
    expect(editor.getByLabelText('Cena do OBS'), 'its filter').toBeDisabled();
    expect(editor.getByText(whyNotChangingAnAutoTrigger), 'the reason is on screen').toBeTruthy();
    expect(editor.getByLabelText('Nome do gatilho'), 'its name').toBeEnabled();
  });

  it('opens them again once Dados sets it back to "Perguntar"', () => {
    // Arrange: Dados editing "Entrou no box".
    openTheTriggersAs(dataRoleAtMesa2);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Entrou no box' }));

    // Act: choose "Perguntar".
    chooseOptionInDropdown('Modo', 'Perguntar');

    // Assert: a trigger that asks is Dados's to change.
    expect(screen.getByRole('combobox', { name: 'Macro' }), 'its macro').toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Quando' }), 'its kind').toBeEnabled();
    expect(screen.queryByText(whyNotChangingAnAutoTrigger), 'nothing to explain').toBe(null);
  });
});

describe('the rules, for Dados', () => {
  it('offer "Automático" greyed out on a rule that asks, saying why', () => {
    // Arrange: Dados on "Regras".
    openTheRulesAs(dataRoleAtMesa2);

    // Act: look at the "Incidente" row, which asks.
    const incidentRow = within(screen.getByRole('group', { name: 'Incidente' }));

    // Assert: the option greyed out, and the sentence in the row.
    expect(
      isOptionGreyedOut(
        incidentRow.getByRole('combobox', { name: 'Modo de Incidente' }),
        'Automático',
      ),
      'Dados may not switch a rule to auto',
    ).toBe(true);
    expect(incidentRow.getByText(whyNotAnAutoRule), 'the reason is in the row').toBeTruthy();
  });

  it('grey out the item and times of an auto rule, saying why', () => {
    // Arrange: Dados on "Regras".
    openTheRulesAs(dataRoleAtMesa2);

    // Act: look at the "Volta mais rápida" row, which is auto.
    const fastestLapRow = within(screen.getByRole('group', { name: 'Volta mais rápida' }));

    // Assert: what it airs and for how long are the Produtor's; its mode may go down.
    expect(
      fastestLapRow.getByRole('combobox', { name: 'Item de Volta mais rápida' }),
      'its item',
    ).toBeDisabled();
    expect(
      fastestLapRow.getByLabelText('Segundos no ar de Volta mais rápida'),
      'its seconds on air',
    ).toBeDisabled();
    expect(
      fastestLapRow.getByLabelText('Espera máxima (s) de Volta mais rápida'),
      'its maximum wait',
    ).toBeDisabled();
    expect(
      fastestLapRow.getByRole('combobox', { name: 'Modo de Volta mais rápida' }),
      'its mode may still be set back to asking',
    ).toBeEnabled();
    expect(
      fastestLapRow.getByText(whyNotChangingAnAutoRule),
      'the reason is in the row',
    ).toBeTruthy();
  });
});
