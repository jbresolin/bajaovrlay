/**
 * "Gatilhos pausados" in the console's header (apps/control)
 *
 * What this module is for:
 *   A pause of every trigger (BAJAOVRLAY-48) is started from the header's menu since
 *   BAJAOVRLAY-62. A pause hidden in a menu is a show risk, so while the triggers are
 *   paused the header shows a small chip, "Gatilhos pausados", with "Retomar" on it. It
 *   follows the server's `triggerActivity` slice, so every open page agrees.
 *
 * What these tests prove:
 *   - While the triggers run there is no chip.
 *   - Paused, the chip is there; "Retomar" asks the server to let them run again.
 *   - The chip goes away when the server says they run again, from any page.
 *   - For Dados, "Retomar" is greyed out with the role's reason written in the chip, and
 *     sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - Pausing, from the menu; features/headerMenu/HeaderMenu.test.tsx.
 *   - What a pause does on the server; apps/server's triggerFiring.test.ts.
 */
import type { SessionAnswer } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheTriggers } from '@/state/triggersLikeTheServerSends.testSupport';

import { TriggersPausedChip } from './TriggersPausedChip';

const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-10-11T07:00:00.000Z' },
};

describe('the "Gatilhos pausados" chip', () => {
  it('is not there while the triggers run', () => {
    // Arrange: nothing beyond a page whose triggers run.

    // Act: draw the chip.
    renderOnControlPageConnectedToFakeServer(<TriggersPausedChip />, buildSlicesWithTheTriggers());

    // Assert: nothing warns.
    expect(screen.queryByText('Gatilhos pausados'), 'nothing warns while they run').toBe(null);
  });

  it('is there while paused, and "Retomar" lets the triggers run again', () => {
    // Arrange: the triggers paused for the rehearsal.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <TriggersPausedChip />,
      buildSlicesWithTheTriggers([], true),
    );
    const chipText = screen.queryByText('Gatilhos pausados');

    // Act: press "Retomar".
    fireEvent.click(screen.getByRole('button', { name: 'Retomar' }));

    // Assert: the chip was seen, and the press unpauses.
    expect(chipText, 'paused must be seen in the header').toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'the press lets them run again').toEqual([
      { type: 'setTriggersPaused', isPaused: false },
    ]);
  });

  it('goes away when the server says the triggers run again', () => {
    // Arrange: the triggers paused, the chip on screen.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <TriggersPausedChip />,
      buildSlicesWithTheTriggers([], true),
    );
    const isTheChipThereBefore = screen.queryByText('Gatilhos pausados') !== null;

    // Act: another page resumed them; the server sends the new triggerActivity.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'triggerActivity',
      slice: { isPaused: false, lastFiredAtMsByTriggerId: {}, firings: [] },
    });

    // Assert: there before, gone after.
    expect(isTheChipThereBefore, 'the chip is there while paused').toBe(true);
    expect(screen.queryByText('Gatilhos pausados'), 'resumed, the chip must go').toBe(null);
  });

  it('greys out "Retomar" for Dados, with the reason, and sends nothing', async () => {
    // Arrange: the triggers paused, on the page of Dados at "Mesa 2".
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <TriggersPausedChip />,
      buildSlicesWithTheTriggers([], true),
      { sessionAnswer: dataRoleAtMesa2 },
    );
    const resumeButton = await waitFor(() => screen.getByRole('button', { name: 'Retomar' }));

    // Act: try to press it.
    fireEvent.click(resumeButton);

    // Assert: off, with the role's sentence written in the chip (a title shows only on
    // hover, which a greyed-out button never gets), and nothing sent.
    expect(resumeButton, '"Retomar" is greyed out for Dados, never hidden').toBeDisabled();
    expect(
      screen.getByText('O papel Dados não pode fazer isso: é com o Produtor.'),
      'the chip says why in its text, in pt-BR',
    ).toBeVisible();
    expect(fakeServer.listCommandsReceived(), 'Dados’s press sends nothing').toEqual([]);
  });
});
