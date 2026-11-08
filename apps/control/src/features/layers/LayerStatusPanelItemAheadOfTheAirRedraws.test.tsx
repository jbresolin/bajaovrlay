/**
 * What "item mudou" redraws while a race runs (apps/control)
 *
 * What this module is for:
 *   A source polls every half second during a race. BAJAOVRLAY-45 made the item editor
 *   redraw only what a poll changed; the chip "item mudou" in Camadas follows the same
 *   rule (BAJAOVRLAY-38): it reads its own instance and item from the store by itself and
 *   compares the fields behind by value, so a poll that refreshes a bound field on air,
 *   which changes the instances slice, does not draw it again.
 *
 * What these tests prove, on the race clock on air whose title and flag follow the
 * simulator and whose item was given the leader's 34 laps after the take:
 *   - A poll that only brings new data (no field on air changes) redraws neither the
 *     clock's row nor its chip.
 *   - A poll whose refresh changes the bound flag on air (a new instances slice) does not
 *     redraw the chip, and the chip still names the laps.
 *
 * How a draw is counted: the row draws its "Limpar" button and the chip its Badge once per
 * draw, so ActionButton and the ui Badge are replaced by stand-ins that count their draws
 * by text (drawCounterByText.testSupport.tsx).
 *
 * What these tests deliberately do not cover:
 *   - What the chip says and offers: LayerStatusPanelItemAheadOfTheAir.test.tsx and
 *     LayerStatusPanelItemAheadOfTheAirButtons.test.tsx.
 *   - That the row itself is not drawn again when the instances slice changes: the panel
 *     reads the whole slice for every row, as it did before this chip (left as it is).
 */
import type { Item } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildBoundRaceClockOnAir,
  buildSlicesWithTheBoundRaceClockOnAir,
  idOfTheBoundRaceClockItem,
} from '@/state/boundInstancesLikeTheServerSends.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduroSnapshotUnderRedFlag,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { countDrawsOfText, startCountingDrawsByText } from './drawCounterByText.testSupport';
import { LayerStatusPanel } from './LayerStatusPanel';

// The ui Badge and ActionButton are replaced by stand-ins that count their draws (header).
vi.mock('@/components/ui/badge', async (importOriginal) => {
  const badge = await importOriginal<typeof import('@/components/ui/badge')>();
  const { wrapComponentCountingDrawsByText } = await import('./drawCounterByText.testSupport');
  return { ...badge, Badge: wrapComponentCountingDrawsByText(badge.Badge) };
});
vi.mock('@/features/connection/ActionButton', async (importOriginal) => {
  const actionButton = await importOriginal<typeof import('@/features/connection/ActionButton')>();
  const { wrapComponentCountingDrawsByText } = await import('./drawCounterByText.testSupport');
  return {
    ...actionButton,
    ActionButton: wrapComponentCountingDrawsByText(actionButton.ActionButton),
  };
});

// The moment the server sends the next poll, a second after the lap-34 data.
const momentOfTheNextPollMs = Date.parse('2027-03-20T19:30:01.000Z');

/**
 * The item the bound clock was taken from: title and flag read live from the simulator,
 * the clock typed as it stands on air, and the leader's 34 laps typed in after the take.
 */
function buildBoundRaceClockItemWithTheLapsTypedIn(): Item {
  const dataOnAir = buildBoundRaceClockOnAir().resolvedData;
  return {
    id: idOfTheBoundRaceClockItem,
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: {
        kind: 'binding',
        sourceId: seededSimulatorId,
        shapeKey: 'session',
        path: 'sessionName',
        isLive: true,
      },
      state: {
        kind: 'binding',
        sourceId: seededSimulatorId,
        shapeKey: 'session',
        path: 'state',
        isLive: true,
      },
      clockMode: { kind: 'literal', value: dataOnAir.clockMode },
      referenceTimeMs: { kind: 'literal', value: dataOnAir.referenceTimeMs },
      referenceWallClockMs: { kind: 'literal', value: dataOnAir.referenceWallClockMs },
      running: { kind: 'literal', value: dataOnAir.running },
      lapsCompletedByLeader: { kind: 'literal', value: 34 },
    },
    label: 'Relógio do enduro — fonte',
    color: 'success',
    notes: '',
  };
}

/** Draws Camadas with the bound clock on air, behind its item on the laps. */
function renderCamadasWithTheBoundClockBehindItsItem() {
  return renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, {
    ...buildSlicesWithTheBoundRaceClockOnAir({}),
    items: [buildBoundRaceClockItemWithTheLapsTypedIn()],
  });
}

/** The Camadas row of the clock. */
function findClockRow() {
  return within(screen.getByRole('listitem', { name: 'Relógio' }));
}

describe('the chip "item mudou" while a source polls', () => {
  it('redraws neither the row nor the chip when a poll changes nothing on air', () => {
    // Arrange: the bound clock behind its item, every draw so far forgotten.
    const { fakeServer } = renderCamadasWithTheBoundClockBehindItsItem();
    const chipBefore = findClockRow().queryByText('item mudou');
    startCountingDrawsByText();

    // Act: the next poll arrives; the server refreshes nothing on air from it.
    fakeServer.sendMessage({
      type: 'dataSnapshot',
      sourceId: seededSimulatorId,
      snapshot: buildEnduroSnapshotUnderRedFlag(seededSimulatorId),
      serverNowMs: momentOfTheNextPollMs,
    });

    // Assert: the chip was there, and neither the row nor the chip was drawn again.
    expect(chipBefore, 'the clock must be behind its item, or nothing was tested').not.toBeNull();
    expect(countDrawsOfText('Limpar'), 'a poll must not redraw the Camadas row').toBe(0);
    expect(countDrawsOfText('item mudou'), 'a poll must not redraw the chip').toBe(0);
  });

  it('does not redraw the chip when a poll refreshes a bound field on air', async () => {
    // Arrange: the bound clock behind its item, every draw so far forgotten.
    const { fakeServer } = renderCamadasWithTheBoundClockBehindItsItem();
    startCountingDrawsByText();

    // Act: the refresh after the poll puts the red flag on air (a new instances slice).
    const clockOnAir = buildBoundRaceClockOnAir();
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [{ ...clockOnAir, resolvedData: { ...clockOnAir.resolvedData, state: 'red' } }],
    });

    // Assert: the row took the new slice, the chip was not drawn again and still names the laps.
    expect(countDrawsOfText('Limpar'), 'the row must have taken the new slice').toBeGreaterThan(0);
    expect(countDrawsOfText('item mudou'), 'a refreshed bound field must not redraw the chip').toBe(
      0,
    );
    fireEvent.focus(findClockRow().getByText('item mudou'));
    await waitFor(() => {
      expect(
        screen.getByRole('tooltip').textContent,
        'the chip must still name the laps alone',
      ).toContain('Item mudou: Voltas do líder');
    });
  });
});
