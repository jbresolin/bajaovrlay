/**
 * Rundown panel: the hint while the cursor is on nothing (apps/control)
 *
 * What this module is for:
 *   With the cursor on nothing, Space has nothing to take until the operator puts the
 *   cursor somewhere. Without a word on screen that looks like a keyboard that stopped
 *   working in the middle of a show. So the panel says why: "Fim do rundown — clique num
 *   item para posicionar o cursor" after the last item was taken at the cursor, and plain
 *   "Clique num item para posicionar o cursor" when the rundown was not played to its end.
 *
 * What these tests prove:
 *   - With items in the rundown, the cursor on nothing and the rundown marked as played
 *     to its end, the end-of-rundown hint is on screen.
 *   - With items and the cursor on nothing but no such mark, the plain hint is on screen
 *     and the end-of-rundown one is not.
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
import {
  buildMainRundown,
  buildSlicesWithTheEnduranceRundown,
} from '@/state/rundownLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

const endOfRundownHint = 'Fim do rundown — clique num item para posicionar o cursor';
const placeTheCursorHint = 'Clique num item para posicionar o cursor';

describe('the hint while the cursor is on nothing', () => {
  it('says the rundown ended when its last item was taken at the cursor', () => {
    // Arrange: the endurance rundown after its last item was fired with Space: the
    // cursor is on nothing and the server marked the rundown as played to its end.
    const slicesAfterTheLastItemWasFired = {
      ...buildSlicesWithTheEnduranceRundown(null),
      rundowns: [{ ...buildMainRundown(null), wasLastItemTakenAtCursor: true }],
    };

    // Act: draw the rundown panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slicesAfterTheLastItemWasFired);

    // Assert: the hint tells the operator how to get Space working again.
    expect(
      screen.queryByText(endOfRundownHint),
      'with the cursor on nothing the panel must say the rundown ended and how to place the cursor',
    ).not.toBeNull();
  });

  it('only asks for the cursor to be placed when the rundown was not played to its end', () => {
    // Arrange: the endurance rundown with three items and a cursor nobody placed yet.
    const slicesWithACursorNobodyPlaced = buildSlicesWithTheEnduranceRundown(null);

    // Act: draw the rundown panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slicesWithACursorNobodyPlaced);

    // Assert: the plain hint, and no word about the rundown having ended.
    expect(
      screen.queryByText(placeTheCursorHint),
      'with the cursor on nothing and no mark the panel must ask for the cursor to be placed',
    ).not.toBeNull();
    expect(
      screen.queryByText(endOfRundownHint),
      'a rundown that was not played to its end must not say it ended',
    ).toBeNull();
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
    expect(
      screen.queryByText(placeTheCursorHint),
      'the place-the-cursor hint must not show while an item is marked as next',
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
      screen.queryByText(placeTheCursorHint),
      'an empty rundown has no item to click, so the place-the-cursor hint must not show',
    ).toBeNull();
    expect(
      screen.getByText('Nenhum item neste rundown. Use "+ Item" para preparar o primeiro.'),
      'an empty rundown must keep its own message',
    ).toBeTruthy();
  });
});
