/**
 * Rundown panel: the hint at the end of the rundown (apps/control)
 *
 * What this module is for:
 *   After the last item is fired the cursor is on nothing, and Space has nothing to take
 *   until the operator puts the cursor somewhere again. Without a word on screen that
 *   looks like a keyboard that stopped working in the middle of a show. So the panel says
 *   "Fim do rundown — clique num item para posicionar o cursor".
 *
 * What these tests prove:
 *   - With items in the rundown and the cursor on nothing, the hint is on screen.
 *   - With the cursor on an item there is no hint: Space has something to take.
 *   - In a rundown with no items there is no hint either; the panel already says the
 *     rundown is empty, and there is no item to click.
 *
 * What these tests deliberately do not cover:
 *   - How the cursor comes to be on nothing (the server's takeItem.test.ts) and how a
 *     click or an arrow puts it back (RundownPanelCursor.test.tsx).
 *   - The refusal the server answers when Space is pressed with no cursor; the panel
 *     shows it through CommandErrorMessage, which has its own tests.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheEnduranceRundown } from '@/state/rundownLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

const endOfRundownHint = 'Fim do rundown — clique num item para posicionar o cursor';

describe('the hint at the end of the rundown', () => {
  it('is shown when the rundown has items and the cursor is on nothing', () => {
    // Arrange: the endurance rundown after its last item was fired, so no item is next.
    const slicesAfterTheLastItemWasFired = buildSlicesWithTheEnduranceRundown(null);

    // Act: draw the rundown panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slicesAfterTheLastItemWasFired);

    // Assert: the hint tells the operator how to get Space working again.
    expect(
      screen.queryByText(endOfRundownHint),
      'with the cursor on nothing the panel must say the rundown ended and how to place the cursor',
    ).not.toBeNull();
  });

  it('is not shown while the cursor is on an item', () => {
    // Arrange: the endurance rundown with the start of the race as the next item.
    const slicesWithTheStartAsNext = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');

    // Act: draw the rundown panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slicesWithTheStartAsNext);

    // Assert: no hint, because Space has an item to take.
    expect(
      screen.queryByText(endOfRundownHint),
      'the end-of-rundown hint must not show while an item is marked as next',
    ).toBeNull();
  });

  it('is not shown in a rundown that has no items', () => {
    // Arrange: a new session: the seeded rundown with nothing prepared yet.
    const slicesWithAnEmptyRundown = buildSlicesWithNothingOnAir();

    // Act: draw the rundown panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slicesWithAnEmptyRundown);

    // Assert: the panel says the rundown is empty, and does not also say it ended.
    expect(
      screen.queryByText(endOfRundownHint),
      'an empty rundown has no item to click, so the end-of-rundown hint must not show',
    ).toBeNull();
    expect(
      screen.getByText('Nenhum item neste rundown. Use "+ Item" para preparar o primeiro.'),
      'an empty rundown must keep its own message',
    ).toBeTruthy();
  });
});
