/**
 * Items filled by an event are marked, and never taken by themselves, on the page
 * (apps/control)
 *
 * What this module is for:
 *   An item whose fields read the event it shows (the notices "Volta mais rápida" and
 *   "Penalidade") goes on air only through its event; the server refuses any take of its
 *   own (BAJAOVRLAY-44). Gate 2 of PR #22 asked the page not to offer those takes at all:
 *   one shared check (itemTakenThroughAnEvent.ts) turns off the button of the "Avisos"
 *   panel, the digits 1–9 on it, "Disparar" on a rundown row and Space at the cursor, with
 *   the tooltip "Este item é preenchido por um evento", keeping "Prévia", which shows the
 *   look with a sample event. The macro editor's item picker leaves such items out.
 *
 * What these tests prove:
 *   - The "Penalidade" button of "Avisos" is off and says why on focus; its "Prévia"
 *     still sends previewItem.
 *   - The digit 1 on "Avisos" sends nothing.
 *   - A template in the rundown has "Disparar" off, and Space with the cursor on it sends
 *     nothing; "Prévia" on its row still works.
 *   - The macro editor's item choices leave the templates out.
 *
 * What these tests deliberately do not cover:
 *   - "Salvar e disparar" in the item editor; ItemEditorPanelEventFields.test.tsx.
 *   - The server's own refusals; templateItemTakesOnTheStore.test.ts in apps/server.
 */
import type { Item } from '@bajaovrlay/shared';
import { act, fireEvent, screen, within } from '@testing-library/react';
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

/** The strip with the "Avisos" tab shown. */
function renderTheAvisosPanel() {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <QuickFireStrip />,
    buildSlicesWithTheInbox([]),
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Avisos' }));
  return controlPage;
}

/** The "Penalidade" notice moved into the main rundown, at its cursor. */
function buildPenaltyNoticeInTheRundown(): Item {
  const penaltyNotice = buildNoticeItems()[1];
  if (penaltyNotice === undefined) {
    throw new Error('the notice items must include "Penalidade"');
  }
  return { ...penaltyNotice, home: { kind: 'rundown', rundownId: mainRundownId }, order: 0 };
}

describe('the "Avisos" panel', () => {
  it('turns the "Penalidade" button off, saying why, and keeps its "Prévia"', async () => {
    // Arrange: the "Avisos" panel.
    const { fakeServer } = renderTheAvisosPanel();
    const penaltyButtonRow = within(screen.getByRole('listitem', { name: 'Penalidade' }));

    // Act: focus the button's wrapper (a disabled button cannot be hovered), then choose
    // "Prévia" in its menu.
    const takeButton = penaltyButtonRow.getByRole('button', { name: /^Penalidade/ });
    await act(async () => {
      takeButton.parentElement?.focus();
      await Promise.resolve();
    });
    const tooltipText = (
      await screen.findAllByText(
        'Este item é preenchido por um evento: ele entra no ar pela aba Eventos.',
      )
    )[0];
    fireEvent.contextMenu(takeButton);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Prévia' }));

    // Assert: the take is off and explained; the preview was sent.
    expect(takeButton, 'a template cannot be taken by itself').toBeDisabled();
    expect(tooltipText, 'the page must say why').toBeTruthy();
    expect(fakeServer.listCommandsReceived(), 'only the preview is sent').toEqual([
      { type: 'previewItem', itemId: 'penalidade', origin: 'manual' },
    ]);
  });

  it('sends nothing for the digit of a template', () => {
    // Arrange: the "Avisos" panel, whose first button is "Volta mais rápida".
    const { fakeServer } = renderTheAvisosPanel();

    // Act: press 1.
    fireEvent.keyDown(document.body, { key: '1' });

    // Assert: nothing sent.
    expect(fakeServer.listCommandsReceived(), 'a digit must not take a template').toEqual([]);
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
