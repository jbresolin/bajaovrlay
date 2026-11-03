/**
 * A trigger's firing that asks, in the console's "Eventos" tab (apps/control)
 *
 * What this module is for:
 *   A trigger set to "Perguntar", or set to "Automático" while another macro was running,
 *   puts a firing in the "Eventos" tab instead of running its macro (BAJAOVRLAY-48), as
 *   the event inbox does with an event that asks. The row reads "Gatilho: <nome> →
 *   <macro>" with the firing's data, and offers "Rodar" and "Descartar"; a firing dismissed
 *   in the last 30 s offers "Desfazer".
 *
 * What these tests prove:
 *   - A waiting firing shows its trigger, its macro, its data and when it fired.
 *   - An auto firing that had to ask says why it did not run by itself.
 *   - "Rodar" sends runTriggerFiring, "Descartar" dismissTriggerFiring.
 *   - A firing dismissed 10 s ago offers "Desfazer", sending restoreTriggerFiring; one
 *     dismissed 40 s ago does not.
 *   - The tab's badge counts the waiting firing with the waiting events.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with the commands; apps/server's triggerFiring.test.ts.
 */
import type { TriggerFiring } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { formatTimeOfDay } from '@/i18n/timeOfDayText';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { nowInTheInboxTests } from '@/state/eventsLikeTheServerSends.testSupport';
import {
  buildBoxEnteredFiringThatHadToAsk,
  buildDeskButtonFiringDismissedSecondsAgo,
  buildPendingDeskButtonFiring,
  buildSlicesWithTheTriggers,
} from '@/state/triggersLikeTheServerSends.testSupport';

afterEach(() => {
  vi.useRealTimers();
});

/** The strip at 14:10 with these firings, showing the "Eventos" tab. */
function renderTheEventsTabWith(firings: TriggerFiring[]) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowInTheInboxTests);
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <QuickFireStrip />,
    buildSlicesWithTheTriggers(firings),
  );
  fireEvent.click(screen.getByRole('tab', { name: /^Eventos/ }));
  return controlPage;
}

/** The rows of the waiting firings, top to bottom. */
function readWaitingFiringRows() {
  return within(screen.getByRole('list', { name: 'Gatilhos esperando' })).getAllByRole('listitem');
}

describe('a firing that waits', () => {
  it('shows its trigger, its macro, its data and when it fired', () => {
    // Arrange: the desk button fired 2 min ago with Ana Souza's name and car 47.
    const firing = buildPendingDeskButtonFiring(2);
    renderTheEventsTabWith([firing]);

    // Act: read its row.
    const row = within(readWaitingFiringRows()[0] ?? document.body);

    // Assert: the trigger and its macro, each piece of data, the time and the age.
    expect(
      row.getByText('Gatilho: Botão da mesa → Fechar a sessão'),
      'the row names the trigger and the macro it would run',
    ).toBeInTheDocument();
    expect(row.getByText('nome: Ana Souza'), 'its name').toBeInTheDocument();
    expect(row.getByText('carro: 47'), 'its car').toBeInTheDocument();
    expect(
      row.getByText(formatTimeOfDay(firing.firedAtMs)),
      'the time it fired',
    ).toBeInTheDocument();
    expect(row.getByText('há 2 min'), 'and how long ago').toBeInTheDocument();
  });

  it('says why an auto firing did not run by itself', () => {
    // Arrange: "Entrou no box" fired while "Fechar a sessão" was running.
    renderTheEventsTabWith([buildBoxEnteredFiringThatHadToAsk()]);

    // Act: read its row.
    const row = within(readWaitingFiringRows()[0] ?? document.body);

    // Assert: the server's reason.
    expect(
      row.getByText(
        'Não rodou sozinho: A macro "Abrir a sessão" não pode começar enquanto a macro "Fechar a sessão" está rodando.',
      ),
      'the operator must see why it waits',
    ).toBeInTheDocument();
  });

  const buttonsAndTheirCommands = [
    // "Rodar": the operator says yes.
    {
      name: '"Rodar" sends runTriggerFiring',
      buttonName: 'Rodar',
      commandType: 'runTriggerFiring',
    },
    // "Descartar": the operator says no.
    {
      name: '"Descartar" sends dismissTriggerFiring',
      buttonName: 'Descartar',
      commandType: 'dismissTriggerFiring',
    },
  ];

  it.each(buttonsAndTheirCommands)('$name', ({ buttonName, commandType }) => {
    // Arrange: the desk button's firing waits.
    const { fakeServer } = renderTheEventsTabWith([buildPendingDeskButtonFiring(2)]);
    const row = within(readWaitingFiringRows()[0] ?? document.body);

    // Act: press the button.
    fireEvent.click(row.getByRole('button', { name: buttonName }));

    // Assert: one command naming the firing.
    expect(fakeServer.listCommandsReceived(), 'the button sends its command').toEqual([
      { type: commandType, firingId: 'disparo-ana-souza' },
    ]);
  });

  it('counts on the tab’s badge with the events', () => {
    // Arrange and act: one firing waits, no event.
    renderTheEventsTabWith([buildPendingDeskButtonFiring(2)]);

    // Assert: the tab reads "Eventos 1".
    expect(
      screen.getByRole('tab', { name: /^Eventos/ }).textContent,
      'a waiting firing must show on the badge',
    ).toContain('1');
  });
});

describe('"Desfazer" after "Descartar"', () => {
  it('is offered for a firing dismissed 10 s ago, sending restoreTriggerFiring', () => {
    // Arrange: the desk button's firing, dismissed 10 s ago.
    const { fakeServer } = renderTheEventsTabWith([buildDeskButtonFiringDismissedSecondsAgo(10)]);
    const dismissedList = within(
      screen.getByRole('list', { name: 'Gatilhos descartados agora há pouco' }),
    );

    // Act: press "Desfazer".
    fireEvent.click(dismissedList.getByRole('button', { name: 'Desfazer' }));

    // Assert: restoreTriggerFiring for that firing.
    expect(fakeServer.listCommandsReceived(), 'the slip is undone').toEqual([
      { type: 'restoreTriggerFiring', firingId: 'disparo-ana-souza' },
    ]);
  });

  it('is not offered for a firing dismissed 40 s ago', () => {
    // Arrange and act: the desk button's firing, dismissed 40 s ago.
    renderTheEventsTabWith([buildDeskButtonFiringDismissedSecondsAgo(40)]);

    // Assert: no list of recent dismissals.
    expect(
      screen.queryByRole('list', { name: 'Gatilhos descartados agora há pouco' }),
      'past 30 s the console no longer offers it',
    ).toBe(null);
  });
});
