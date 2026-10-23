/**
 * "Regras": the rules of the event inbox (apps/control)
 *
 * What this module is for:
 *   Each kind of event has one rule on the server (BAJAOVRLAY-44): ask the operator ("Perguntar"),
 *   go on air by itself ("Automático") or not even list it ("Ignorar"); the item that shows
 *   it; how long it stays on air; and how long it may wait before it expires. "Regras" in
 *   the "Eventos" tab lists the five rules, one row each, and "Salvar" on a row sends
 *   updateEventRule with that row. A Super Chat is never shown without approval, so its
 *   rule offers "Perguntar" only and says why; a manual event cannot be ignored.
 *
 * What these tests prove:
 *   - The five rules are listed with their mode, item, seconds on air and maximum wait
 *     ("sem limite" when there is none).
 *   - Changing the fastest lap to "Perguntar" and 10 seconds, then "Salvar", sends the
 *     whole rule in updateEventRule, the times in ms.
 *   - The Super Chat row offers "Perguntar" only and explains it; the manual row offers no
 *     "Ignorar".
 *   - A duration under one second is refused on the page in pt-BR, sending nothing.
 *
 * What these tests deliberately do not cover:
 *   - What each mode does on the server; apps/server/src/modules/events.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheInbox } from '@/state/eventsLikeTheServerSends.testSupport';

/** The strip on the "Eventos" tab, with "Regras" open. */
function openTheRules() {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <QuickFireStrip />,
    buildSlicesWithTheInbox([]),
  );
  fireEvent.click(screen.getByRole('tab', { name: /^Eventos/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Regras' }));
  return controlPage;
}

/** The row of one kind of event in the rules, by its name. */
function findRuleRow(kindName: string) {
  return within(screen.getByRole('group', { name: kindName }));
}

/** The options a dropdown offers, by its accessible name, as the operator reads them. */
function readOptionsOfDropdown(dropdownName: string): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  const optionNames = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getAllByRole('option')[0] ?? document.body, { key: 'Escape' });
  return optionNames;
}

describe('the rules editor', () => {
  it('lists the five rules with mode, item, seconds on air and maximum wait', () => {
    // Arrange: João's default rules.
    openTheRules();

    // Act: read the fastest lap's row and the leader change's.
    const fastestLapRow = findRuleRow('Volta mais rápida');
    const leaderChangeRow = findRuleRow('Mudança de líder');

    // Assert: each control shows the rule as the server holds it.
    expect(
      fastestLapRow.getByRole('combobox', { name: 'Modo de Volta mais rápida' }).textContent,
      'fastest laps go on air by themselves',
    ).toBe('Automático');
    expect(
      fastestLapRow.getByRole('combobox', { name: 'Item de Volta mais rápida' }).textContent,
      'with the seeded item',
    ).toBe('Volta mais rápida');
    expect(
      fastestLapRow.getByLabelText('Segundos no ar de Volta mais rápida'),
      '8 seconds on air',
    ).toHaveValue('8');
    expect(
      fastestLapRow.getByLabelText('Espera máxima (s) de Volta mais rápida'),
      'and 2 minutes at most in the queue',
    ).toHaveValue('120');
    expect(
      leaderChangeRow.getByRole('combobox', { name: 'Item de Mudança de líder' }).textContent,
      'a leader change has no item yet',
    ).toBe('Nenhum');
    expect(
      screen.getAllByRole('group').map((group) => group.getAttribute('aria-label')),
      'one row per kind',
    ).toEqual([
      'Ocorrência',
      'Volta mais rápida',
      'Mudança de líder',
      'Evento digitado',
      'Super Chat',
    ]);
  });

  it('sends the whole rule when a changed row is saved', () => {
    // Arrange: the fastest lap set to wait for the operator, 10 seconds on air.
    const { fakeServer } = openTheRules();
    chooseOptionInDropdown('Modo de Volta mais rápida', 'Perguntar');
    fireEvent.change(screen.getByLabelText('Segundos no ar de Volta mais rápida'), {
      target: { value: '10' },
    });

    // Act: save the row.
    fireEvent.click(findRuleRow('Volta mais rápida').getByRole('button', { name: 'Salvar' }));

    // Assert: one updateEventRule with the whole rule, the times in ms.
    expect(fakeServer.listCommandsReceived(), 'the row is sent whole').toEqual([
      {
        type: 'updateEventRule',
        kind: 'fastestLap',
        mode: 'ask',
        itemId: 'volta-mais-rapida',
        durationMs: 10_000,
        maxAgeMs: 120_000,
      },
    ]);
  });

  it('offers only "Perguntar" for a Super Chat, saying why, and no "Ignorar" for a typed event', () => {
    // Arrange: the rules.
    openTheRules();

    // Act: read the modes of the Super Chat and of the typed events.
    const superChatModes = readOptionsOfDropdown('Modo de Super Chat');
    const manualModes = readOptionsOfDropdown('Modo de Evento digitado');

    // Assert: Super Chat asks, always, and says so; a typed event is never ignored.
    expect(superChatModes, "a viewer's message always waits for approval").toEqual(['Perguntar']);
    expect(
      findRuleRow('Super Chat').getByText(
        'Super Chat nunca entra no ar sozinho: o conteúdo de um espectador sempre espera aprovação.',
      ),
      'the row says why',
    ).toBeInTheDocument();
    expect(manualModes, 'a typed event is asked or shown, never ignored').toEqual([
      'Perguntar',
      'Automático',
    ]);
  });

  it('refuses a duration under one second, sending nothing', () => {
    // Arrange: the penalty's seconds on air emptied to 0.
    const { fakeServer } = openTheRules();
    fireEvent.change(screen.getByLabelText('Segundos no ar de Ocorrência'), {
      target: { value: '0' },
    });

    // Act: save the row.
    fireEvent.click(findRuleRow('Ocorrência').getByRole('button', { name: 'Salvar' }));

    // Assert: the problem said in the row, nothing sent.
    expect(findRuleRow('Ocorrência').getByRole('alert').textContent, 'why it was refused').toBe(
      'Informe os segundos no ar, de 1 a 3600.',
    );
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });
});
