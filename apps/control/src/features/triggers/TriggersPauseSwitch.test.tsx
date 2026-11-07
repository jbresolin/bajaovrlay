/**
 * "Pausar gatilhos" in the console's header (apps/control)
 *
 * What this module is for:
 *   One switch pauses every trigger for a rehearsal (BAJAOVRLAY-48): while it is on, no
 *   scene, call, event or time fires a macro. It sits in the header, where the operator
 *   always sees it, and follows the server's `triggerActivity` slice (the pause lives in
 *   the server's memory and a restart starts unpaused), so every open page agrees.
 *
 * What these tests prove:
 *   - Unpaused, the switch is off and nothing warns; pressing it sends
 *     setTriggersPaused with isPaused true.
 *   - Paused, the switch is on with "Gatilhos pausados" beside it; pressing it sends
 *     isPaused false.
 *
 * What these tests deliberately do not cover:
 *   - What a pause does on the server; apps/server's triggerFiring.test.ts.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheTriggers } from '@/state/triggersLikeTheServerSends.testSupport';

import { TriggersPauseSwitch } from './TriggersPauseSwitch';

describe('"Pausar gatilhos"', () => {
  it('pauses the triggers when pressed while they run', () => {
    // Arrange: the header's switch, the triggers running.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <TriggersPauseSwitch />,
      buildSlicesWithTheTriggers([], false),
    );
    const isCheckedBefore = screen
      .getByRole('switch', { name: 'Pausar gatilhos' })
      .getAttribute('aria-checked');

    // Act: press it.
    fireEvent.click(screen.getByRole('switch', { name: 'Pausar gatilhos' }));

    // Assert: it was off with no warning, and the press asks the server to pause.
    expect(isCheckedBefore, 'unpaused, the switch is off').toBe('false');
    expect(screen.queryByText('Gatilhos pausados'), 'nothing warns while they run').toBe(null);
    expect(fakeServer.listCommandsReceived(), 'the press pauses every trigger').toEqual([
      { type: 'setTriggersPaused', isPaused: true },
    ]);
  });

  it('shows "Gatilhos pausados" while paused, and a press lets them run again', () => {
    // Arrange: the triggers paused for the rehearsal.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <TriggersPauseSwitch />,
      buildSlicesWithTheTriggers([], true),
    );

    // Act: press the switch.
    fireEvent.click(screen.getByRole('switch', { name: 'Pausar gatilhos' }));

    // Assert: the warning was there, and the press unpauses.
    expect(screen.getByText('Gatilhos pausados'), 'paused must be seen').toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'the press lets them run again').toEqual([
      { type: 'setTriggersPaused', isPaused: false },
    ]);
  });
});
