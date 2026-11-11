/**
 * Items filled by an event are marked, and never taken by themselves, on the page
 * (apps/control)
 *
 * What this module is for:
 *   An item whose fields read the event it shows (the notices "Volta mais rápida" and
 *   "Penalidade") goes on air only through its event; the server refuses any take of its
 *   own (BAJAOVRLAY-44). Gate 2 of PR #22 asked the page not to offer those takes at all:
 *   one shared check (itemTakenThroughAnEvent.ts) turns off "Disparar" on a rundown row and
 *   Space at the cursor, with the tooltip "Este item é preenchido por um evento", keeping
 *   "Prévia", which shows the look with a sample event. The macro editor's item picker
 *   leaves such items out. Since BAJAOVRLAY-67 no template sits on a quick-fire panel: they
 *   live in "Modelos de evento", shown in "Regras", so the strip has no "Avisos".
 *
 * What these tests prove:
 *   - The strip shows no template and no "Avisos" tab.
 *   - A template in the rundown has "Disparar" off, and Space with the cursor on it sends
 *     nothing; "Prévia" on its row still works.
 *   - The macro editor's item choices leave the templates out.
 *
 * What these tests deliberately do not cover:
 *   - "Salvar e disparar" in the item editor; ItemEditorPanelEventFields.test.tsx.
 *   - The server's own refusals; templateItemTakesOnTheStore.test.ts in apps/server.
 */
import type { Item } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { listItemChoicesForMacroSteps } from '@/features/macros/macroStepChoices';
import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildNoticeItems,
  buildSlicesWithTheInbox,
} from '@/state/eventsLikeTheServerSends.testSupport';
import { buildMainRundown, mainRundownId } from '@/state/rundownLikeTheServerSends.testSupport';

vi.mock(
  '@/features/items/ItemEditorPanel',
  () => import('@/features/rundown/itemEditorStandIn.testSupport'),
);

/** The "Penalidade" notice moved into the main rundown, at its cursor. */
function buildPenaltyNoticeInTheRundown(): Item {
  const penaltyNotice = buildNoticeItems()[1];
  if (penaltyNotice === undefined) {
    throw new Error('the notice items must include "Penalidade"');
  }
  return { ...penaltyNotice, home: { kind: 'rundown', rundownId: mainRundownId }, order: 0 };
}

describe('the quick-fire strip', () => {
  it('shows no template: no "Avisos" tab, no "Penalidade" button', () => {
    // Arrange: the inbox's slices, the templates in "Modelos de evento" (BAJAOVRLAY-67).
    const slices = buildSlicesWithTheInbox([]);

    // Act: draw the strip.
    renderOnControlPageConnectedToFakeServer(<QuickFireStrip />, slices);

    // Assert: the templates are on no panel: they are chosen and edited in "Regras".
    expect(screen.queryByRole('tab', { name: 'Avisos' }), 'no "Avisos" tab').toBeNull();
    expect(
      screen.queryByRole('listitem', { name: 'Penalidade' }),
      'no template button on any panel',
    ).toBeNull();
  });
});

describe('a template in the rundown', () => {
  it('has "Disparar" off, and Space at the cursor sends nothing', () => {
    // Arrange: the main rundown holding the "Penalidade" notice, at its cursor.
    const slices = buildSlicesWithTheInbox([]);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, {
      ...slices,
      rundowns: [buildMainRundown('penalidade')],
      items: [buildPenaltyNoticeInTheRundown()],
    });

    // Act: press Space.
    fireEvent.keyDown(document.body, { key: ' ' });

    // Assert: its "Disparar" is off, "Prévia" is on, and Space sent nothing.
    const row = within(screen.getByRole('listitem', { name: /Penalidade/ }));
    expect(row.getByRole('button', { name: 'Disparar' }), 'no take of a template').toBeDisabled();
    expect(row.getByRole('button', { name: 'Prévia' }), 'its look can still be seen').toBeEnabled();
    expect(fakeServer.listCommandsReceived(), 'Space must not take a template').toEqual([]);
  });
});

describe("the macro editor's item choices", () => {
  it('leave the templates out', () => {
    // Arrange: the strip's items and the two notices of "Avisos".
    const slices = buildSlicesWithTheInbox([]);

    // Act: list the choices of a "Pôr item no ar" step.
    const choices = listItemChoicesForMacroSteps(
      slices.items,
      slices.rundowns,
      slices.quickFirePanels,
    );

    // Assert: neither notice is offered; the other items are.
    const offeredIds = choices.map((choice) => choice.itemId);
    expect(offeredIds, 'a macro cannot take a template').not.toContain('penalidade');
    expect(offeredIds, 'a macro cannot take a template').not.toContain('volta-mais-rapida');
    expect(offeredIds.length, 'the other items stay offered').toBeGreaterThan(0);
  });
});
