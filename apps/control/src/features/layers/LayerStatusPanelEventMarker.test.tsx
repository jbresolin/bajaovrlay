/**
 * Camadas marks what an event put on air (apps/control)
 *
 * What this module is for:
 *   A notice on air may come from the event inbox (BAJAOVRLAY-44): "No ar", "Tomar" on an
 *   event's Prévia, or the automatic runner. Its instance carries the event's id, and its
 *   Camadas row says so beside the item's name, "evento: penalidade · carro 47", so the
 *   operator knows why the notice is up and which car it is about.
 *
 * What these tests prove, one row per kind of event:
 *   - A penalty reads "evento: penalidade · carro 47"; a fastest lap "evento: volta mais
 *     rápida · carro 31"; a warning "evento: advertência · carro 38".
 *   - An event no longer in the inbox's slice (the slice keeps the newest 200) still reads
 *     "evento", without what it was.
 *   - An instance no event put on air carries no mark.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the row (item, status, chips); LayerStatusPanel.test.tsx and its siblings.
 */
import type { InboxEvent, Instance, Slices } from '@bajaovrlay/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildPendingPenaltyOfCar47,
  buildPendingWarningOfCar38,
  buildQueuedFastestLapOfCar31,
  buildSlicesWithTheInbox,
} from '@/state/eventsLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

/** The notice layer at 45, as the server seeds it. */
const noticeLayer = {
  id: 'notice',
  name: 'Aviso',
  zIndex: 45,
  replacePolicy: 'out-then-in' as const,
  persistent: false,
};

/** The notice on air on its layer, put there by the event of this id (or none). */
function buildNoticeOnAir(itemId: string, eventId: string | undefined): Instance {
  const instance: Instance = {
    id: '6c1e2a90-4b7d-4f35-9a08-2d5e7f1b3c46',
    layerId: 'notice',
    graphicId: 'notice',
    target: 'program',
    resolvedData: { variant: 'penalty', carNumber: 47 },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2027-08-14T14:10:00.000Z',
    itemId,
  };
  if (eventId !== undefined) {
    instance.eventId = eventId;
  }
  return instance;
}

/** The inbox's slices with these events, the notice layer, and this instance on air. */
function buildSlicesWithTheNoticeOnAir(events: InboxEvent[], instance: Instance): Slices {
  const slices = buildSlicesWithTheInbox(events);
  return { ...slices, layers: [...slices.layers, noticeLayer], instances: [instance] };
}

describe('the Camadas row of a notice an event put on air', () => {
  const markerScenarios = [
    // The main case: a penalty the operator approved.
    {
      name: 'marks a penalty with its kind and car',
      event: { ...buildPendingPenaltyOfCar47(1), status: 'onAir' as const },
      expectedMarker: 'evento: penalidade · carro 47',
    },
    // A fastest lap the runner put on air by itself.
    {
      name: 'marks a fastest lap',
      event: { ...buildQueuedFastestLapOfCar31(1), status: 'onAir' as const },
      expectedMarker: 'evento: volta mais rápida · carro 31',
    },
    // A warning is not a penalty, and the row must not say so.
    {
      name: 'marks a warning as a warning',
      event: { ...buildPendingWarningOfCar38(1), status: 'onAir' as const },
      expectedMarker: 'evento: advertência · carro 38',
    },
  ];

  it.each(markerScenarios)('$name', ({ event, expectedMarker }) => {
    // Arrange: the notice on air, put there by this row's event.
    const slices = buildSlicesWithTheNoticeOnAir(
      [event],
      buildNoticeOnAir('penalidade', event.eventId),
    );

    // Act: draw Camadas.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the notice's row carries this row's marker.
    const noticeRow = within(screen.getByRole('listitem', { name: 'Aviso' }));
    expect(noticeRow.getByText(expectedMarker), 'the row must say which event').toBeInTheDocument();
  });

  it('still says "evento" for an event no longer in the inbox', () => {
    // Arrange: the notice on air for an event the slice has dropped.
    const slices = buildSlicesWithTheNoticeOnAir(
      [],
      buildNoticeOnAir('penalidade', 'simulador-enduro:incident:ocorrencia-0001'),
    );

    // Act: draw Camadas.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: "evento" alone.
    const noticeRow = within(screen.getByRole('listitem', { name: 'Aviso' }));
    expect(
      noticeRow.getByText('evento'),
      'the row still says an event put it there',
    ).toBeInTheDocument();
  });

  it('marks nothing on a notice no event put on air', () => {
    // Arrange: the notice on air with no event (only through the API: a template cannot
    // be taken by itself).
    const slices = buildSlicesWithTheNoticeOnAir([], buildNoticeOnAir('penalidade', undefined));

    // Act: draw Camadas.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: no marker.
    const noticeRow = within(screen.getByRole('listitem', { name: 'Aviso' }));
    expect(noticeRow.queryByText(/^evento/), 'no event, no marker').toBeNull();
  });
});
