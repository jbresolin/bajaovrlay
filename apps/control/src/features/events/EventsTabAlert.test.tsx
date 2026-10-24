/**
 * The alert of a new pending event: the badge's pulse and the chime (apps/control)
 *
 * What this module is for:
 *   A penalty waiting for the operator must not go unnoticed while they look at the
 *   rundown (BAJAOVRLAY-44). When the number of pending events goes up, the "Eventos" tab's
 *   badge pulses for a few seconds and the page plays a short chime, unless "Som de
 *   eventos" is off. That switch is this browser's own setting, kept in localStorage: it
 *   is a habit of the person at this keyboard, not a fact about the show, the one
 *   convenience the brief allows outside the server's state.
 *
 * What these tests prove:
 *   - A new pending event makes the badge pulse and plays the chime once.
 *   - The events already waiting when the page opens do not chime, and neither does a
 *     queued one (it goes on air by itself).
 *   - The chime follows the events, not their count: a new pending event arriving as
 *     another leaves chimes (gate 2 of PR #22).
 *   - After a reconnect, a pending event that arrived while the page was away chimes once,
 *     and the ones it had already heard do not chime again.
 *   - With "Som de eventos" switched off the badge still pulses but nothing plays, and the
 *     choice is kept in this browser.
 *
 * What these tests deliberately do not cover:
 *   - The chime's own sound (eventChime.ts uses the browser's Web Audio, which jsdom lacks;
 *     it is replaced here by a stand-in that counts the calls).
 *   - The list of events and its buttons; EventsTab.test.tsx.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildPendingPenaltyOfCar47,
  buildPendingWarningOfCar38,
  buildQueuedFastestLapOfCar31,
  buildSlicesWithTheInbox,
  nowInTheInboxTests,
} from '@/state/eventsLikeTheServerSends.testSupport';

import { playEventChime } from './eventChime';

vi.mock('./eventChime', () => ({ playEventChime: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(playEventChime).mockClear();
  window.localStorage.clear();
});

/** The strip at 14:10 with these events already in the inbox when the page opens. */
function renderTheStripWith(events: InboxEvent[]) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowInTheInboxTests);
  return renderOnControlPageConnectedToFakeServer(
    <QuickFireStrip />,
    buildSlicesWithTheInbox(events),
  );
}

describe('a new pending event', () => {
  it('makes the badge pulse and plays the chime once', () => {
    // Arrange: car 47's penalty already waiting when the page opened.
    const { fakeServer } = renderTheStripWith([buildPendingPenaltyOfCar47(5)]);
    const isPulsingBefore = screen.getByTestId('pending-events-badge').dataset.pulsing;

    // Act: the server lists car 38's warning too.
    act(() => {
      fakeServer.sendMessage({
        type: 'slice',
        name: 'events',
        slice: [buildPendingPenaltyOfCar47(5), buildPendingWarningOfCar38(0)],
      });
    });

    // Assert: still quiet before, pulsing now, one chime.
    expect(isPulsingBefore, 'the events of the opening are no news').toBe('false');
    expect(screen.getByTestId('pending-events-badge').dataset.pulsing, 'it must pulse').toBe(
      'true',
    );
    expect(vi.mocked(playEventChime), 'one chime for one new event').toHaveBeenCalledTimes(1);
  });

  it('does not chime for the events waiting when the page opens, nor for a queued one', () => {
    // Arrange: two pending events when the page opens.
    const { fakeServer } = renderTheStripWith([
      buildPendingPenaltyOfCar47(5),
      buildPendingWarningOfCar38(3),
    ]);

    // Act: a fastest lap arrives, queued for the runner.
    act(() => {
      fakeServer.sendMessage({
        type: 'slice',
        name: 'events',
        slice: [
          buildPendingPenaltyOfCar47(5),
          buildPendingWarningOfCar38(3),
          buildQueuedFastestLapOfCar31(0),
        ],
      });
    });

    // Assert: no chime: nothing new waits for the operator.
    expect(
      vi.mocked(playEventChime),
      'nothing new to approve, nothing to hear',
    ).not.toHaveBeenCalled();
  });
});

describe('the chime across changes and reconnects', () => {
  it('chimes for a new pending event that arrives as another leaves, the count unchanged', () => {
    // Arrange: car 47's penalty waiting when the page opened.
    const { fakeServer } = renderTheStripWith([buildPendingPenaltyOfCar47(5)]);

    // Act: the penalty is dismissed elsewhere and car 38's warning arrives, in one change.
    act(() => {
      fakeServer.sendMessage({
        type: 'slice',
        name: 'events',
        slice: [
          { ...buildPendingPenaltyOfCar47(5), status: 'dismissed' as const },
          buildPendingWarningOfCar38(0),
        ],
      });
    });

    // Assert: one chime: the warning is new, whatever the count says.
    expect(vi.mocked(playEventChime), 'a new event must be heard').toHaveBeenCalledTimes(1);
  });

  it('chimes once after a reconnect for an event that arrived meanwhile, not for the others', () => {
    // Arrange: car 47's penalty waiting when the page opened; the line drops.
    const { fakeServer } = renderTheStripWith([buildPendingPenaltyOfCar47(5)]);
    act(() => {
      fakeServer.dropConnection();
    });

    // Act: the server says hello again with car 38's warning added; then the line drops
    // and comes back once more with the same two.
    const slicesWithBoth = buildSlicesWithTheInbox([
      buildPendingPenaltyOfCar47(5),
      buildPendingWarningOfCar38(1),
    ]);
    act(() => {
      fakeServer.sendMessage({ type: 'hello', slices: slicesWithBoth });
    });
    act(() => {
      fakeServer.dropConnection();
    });
    act(() => {
      fakeServer.sendMessage({ type: 'hello', slices: slicesWithBoth });
    });

    // Assert: one chime, for the warning, the first time only.
    expect(
      vi.mocked(playEventChime),
      'only the event the page had not heard',
    ).toHaveBeenCalledTimes(1);
  });
});

describe('"Som de eventos"', () => {
  it('silences the chime but not the pulse, and is kept in this browser', () => {
    // Arrange: the "Eventos" tab shown, its sound switched off.
    const { fakeServer } = renderTheStripWith([]);
    fireEvent.click(screen.getByRole('tab', { name: /^Eventos/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Som de eventos' }));

    // Act: a penalty arrives.
    act(() => {
      fakeServer.sendMessage({
        type: 'slice',
        name: 'events',
        slice: [buildPendingPenaltyOfCar47(0)],
      });
    });

    // Assert: the badge pulses, nothing plays, and the browser remembers "off".
    expect(screen.getByTestId('pending-events-badge').dataset.pulsing, 'it still pulses').toBe(
      'true',
    );
    expect(vi.mocked(playEventChime), 'the operator switched the sound off').not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem('bajaovrlay.somDeEventos'),
      'the choice is kept in this browser',
    ).toBe('desligado');
  });
});
