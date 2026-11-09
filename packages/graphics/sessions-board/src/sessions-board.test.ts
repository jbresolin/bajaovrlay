/**
 * The sessions board web component: load, play, update, stop and dispose, and each slot's
 * state changing on air (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   sessions-board.ts is the OGraf graphic itself. Each slot's state is worked out on air
 *   from the server-aligned clock (BAJAOVRLAY-46), re-checked on a timer booked for the next
 *   start or end of any slot, never every frame; at the check the changed rows crossfade.
 *
 * What these tests prove (Date and the timers faked, Brasília's clock):
 *   - load draws the six slots by start, their times and states at that moment, off air;
 *     bad data answers 400; calls at the wrong moment answer 409 or 404.
 *   - On air at 09:20 the alignment is "em andamento" on the denser slate; at 10:00, the
 *     enduro's start, the alignment crossfades to "concluída" and the enduro to "em
 *     andamento", with no frame loop: one timer, booked for the boundary.
 *   - An update that adds a slot on air draws it on air with its state; one that ends the
 *     slot in progress now crossfades the two that changed.
 *   - stop, dispose and removal from the page each cancel the status check: no timer is
 *     left, and the boundary passing changes nothing (these fail if the cancel is removed).
 *   - The statuses are the server's clock's, not the machine's.
 *   - An update off air only stores and draws, and books no check; one during the stop-out
 *     leaves the fading board alone and is drawn once it has faded; one during the play-in
 *     is drawn once the board is up.
 *
 * What these tests deliberately do not cover:
 *   - The status rule and the window; sessionsBoardWindow.test.ts on shared's own table.
 *   - Real rendering and motion; e2e/ runs the built graphic in Chromium.
 */
import { finishEveryRunningMotionAtOnce } from '@bajaovrlay/graphics-kit/runningMotions.testSupport';
import {
  forgetTheServerClockAlignment,
  lineUpWithTheServerClockAt,
  readThisMachineMonotonicTimeMs,
} from '@bajaovrlay/shared/clock';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  atSundayBrasiliaTime,
  createSessionsBoardOnThePage,
  createSundaySessionsBoardData,
  isLiveSlateShownOn,
  loadSessionsBoardWithData,
  readRows,
  readStatusShownOf,
  takeControlOfTimeAndTimers,
} from './sessionsBoardOnThePage.testSupport.js';

/** Sunday's board on air at 09:20, the alignment in progress. */
async function putSundaysBoardOnAirAt0920() {
  const timeAndTimers = takeControlOfTimeAndTimers(atSundayBrasiliaTime('09:20'));
  const board = createSessionsBoardOnThePage();
  await loadSessionsBoardWithData(board, createSundaySessionsBoardData());
  await board.playAction({ skipAnimation: true });
  return { board, timeAndTimers };
}

/** The board's title as drawn. */
function readTitle(board: HTMLElement): string | null | undefined {
  return board.shadowRoot?.querySelector('[data-testid="sessions-board-title"]')?.textContent;
}

/** Forty minutes, from 09:20 to the enduro's start at 10:00. */
const untilTheEnduroStartsMs = 40 * 60_000;

describe('load', () => {
  it('draws the six slots by start, each with its time and its state at that moment', async () => {
    // Arrange: 09:20 on Sunday, a board on the page.
    takeControlOfTimeAndTimers(atSundayBrasiliaTime('09:20'));
    const board = createSessionsBoardOnThePage();
    const data = createSundaySessionsBoardData();
    data.slots.reverse();

    // Act: load it with the slots listed backwards.
    const answer = await loadSessionsBoardWithData(board, data);

    // Assert: 200, the design's six rows in order with their states.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readRows(board), 'the slots by start, with their states at 09:20').toEqual([
      { time: '07:30', session: 'Abertura do box', statusShown: 'finished' },
      { time: '08:30', session: 'Briefing das equipes', statusShown: 'finished' },
      { time: '09:15', session: 'Alinhamento do enduro', statusShown: 'inProgress' },
      { time: '10:00', session: 'Enduro de Resistência', statusShown: 'upcoming' },
      { time: '14:30', session: 'Intervalo', statusShown: 'upcoming' },
      { time: '16:00', session: 'Cerimônia de premiação', statusShown: 'upcoming' },
    ]);
  });

  it('answers 400 naming an empty list of slots', async () => {
    // Arrange: a board and data with no slot.
    const board = createSessionsBoardOnThePage();

    // Act: load it.
    const answer = await loadSessionsBoardWithData(board, {
      ...createSundaySessionsBoardData(),
      slots: [],
    });

    // Assert: refused, naming the field.
    expect(answer, 'no slot, no board').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "slots".',
    });
  });

  it('answers 409 before load and after dispose, 404 to a custom action', async () => {
    // Arrange: a board never loaded.
    const board = createSessionsBoardOnThePage();

    // Act: play it, ask a custom action, dispose it and update it.
    const playBeforeLoad = await board.playAction({});
    const customAction = await board.customAction({ id: 'avancar', payload: {} });
    await board.dispose();
    const updateAfterDispose = await board.updateAction({ data: { title: 'PROGRAMAÇÃO' } });

    // Assert: answered, never thrown.
    expect(
      [playBeforeLoad.statusCode, customAction.statusCode, updateAfterDispose.statusCode],
      'wrong-moment calls answer',
    ).toEqual([409, 404, 409]);
  });
});

describe('the states on air', () => {
  it('shows the alignment in progress on the denser slate at 09:20', async () => {
    // Arrange and act: the board on air at 09:20.
    const { board } = await putSundaysBoardOnAirAt0920();

    // Assert: the alignment in progress, its slate the denser one; the enduro's not.
    expect(readStatusShownOf(board, 'Alinhamento do enduro'), 'em andamento').toBe('inProgress');
    expect(isLiveSlateShownOn(board, 'Alinhamento do enduro'), 'the denser slate').toBe(true);
    expect(isLiveSlateShownOn(board, 'Enduro de Resistência'), 'the base slate').toBe(false);
  });

  it('crossfades the alignment to concluída and the enduro to em andamento at 10:00', async () => {
    // Arrange: the board on air at 09:20.
    const { board, timeAndTimers } = await putSundaysBoardOnAirAt0920();
    const timersBeforeTheBoundary = timeAndTimers.countPendingTimers();

    // Act: the clock reaches 10:00, the enduro's start.
    await timeAndTimers.letTimePass(untilTheEnduroStartsMs);

    // Assert: one check was booked, and at the boundary the two rows changed state.
    expect(timersBeforeTheBoundary, 'one timer, never a frame loop').toBe(1);
    expect(readStatusShownOf(board, 'Alinhamento do enduro'), 'the alignment is over').toBe(
      'finished',
    );
    expect(readStatusShownOf(board, 'Enduro de Resistência'), 'the enduro started').toBe(
      'inProgress',
    );
    expect(isLiveSlateShownOn(board, 'Enduro de Resistência'), 'the slate follows').toBe(true);
    expect(isLiveSlateShownOn(board, 'Alinhamento do enduro'), 'and leaves the old row').toBe(
      false,
    );
  });

  it('works the statuses out on the server’s clock, not the machine’s', async () => {
    // Arrange: the machine at 09:58, the server's clock three minutes ahead of it (10:01).
    takeControlOfTimeAndTimers(atSundayBrasiliaTime('09:58'));
    forgetTheServerClockAlignment();
    onTestFinished(() => forgetTheServerClockAlignment());
    lineUpWithTheServerClockAt(Date.now() + 3 * 60_000, readThisMachineMonotonicTimeMs());
    const board = createSessionsBoardOnThePage();

    // Act: load and play the board.
    await loadSessionsBoardWithData(board, createSundaySessionsBoardData());
    await board.playAction({ skipAnimation: true });

    // Assert: at the server's 10:01 the enduro runs and the alignment is over.
    expect(
      [
        readStatusShownOf(board, 'Alinhamento do enduro'),
        readStatusShownOf(board, 'Enduro de Resistência'),
      ],
      'the states at the server’s 10:01',
    ).toEqual(['finished', 'inProgress']);
  });

  it('changes nothing a second before the boundary', async () => {
    // Arrange: the board on air at 09:20.
    const { board, timeAndTimers } = await putSundaysBoardOnAirAt0920();

    // Act: the clock reaches 09:59:59.
    await timeAndTimers.letTimePass(untilTheEnduroStartsMs - 1000);

    // Assert: the alignment still in progress.
    expect(readStatusShownOf(board, 'Alinhamento do enduro'), 'not yet').toBe('inProgress');
  });

  it('draws a slot added on air in its place, with its state', async () => {
    // Arrange: the board on air at 09:20.
    const { board } = await putSundaysBoardOnAirAt0920();
    const data = createSundaySessionsBoardData();

    // Act: Cadastros adds the Super Prime at 12:00.
    await board.updateAction({
      data: {
        slots: [
          ...data.slots,
          {
            slotId: 'super-prime',
            sessionName: 'Super Prime',
            sessionKind: 'speed',
            startsAtMs: atSundayBrasiliaTime('12:00'),
          },
        ],
      },
    });

    // Assert: seven rows, the Super Prime after the enduro, upcoming.
    const sessions = readRows(board).map((row) => row.session);
    expect(sessions[4], 'the new slot by its start').toBe('Super Prime');
    expect(readStatusShownOf(board, 'Super Prime'), 'with its state').toBe('upcoming');
  });

  it('crossfades the two slots an edit changes, when the slot in progress ends now', async () => {
    // Arrange: the board on air at 09:20.
    const { board } = await putSundaysBoardOnAirAt0920();
    const data = createSundaySessionsBoardData();

    // Act: the operator ends the alignment now and starts the enduro now.
    await board.updateAction({
      data: {
        slots: data.slots.map((slot) => {
          if (slot.slotId === 'alinhamento') {
            return { ...slot, endsAtMs: atSundayBrasiliaTime('09:20') };
          }
          if (slot.slotId === 'enduro') {
            return { ...slot, startsAtMs: atSundayBrasiliaTime('09:20') };
          }
          return slot;
        }),
      },
    });

    // Assert: the alignment over, the enduro running.
    expect(
      [
        readStatusShownOf(board, 'Alinhamento do enduro'),
        readStatusShownOf(board, 'Enduro de Resistência'),
      ],
      'the two changed states',
    ).toEqual(['finished', 'inProgress']);
  });
});

describe('the status check stopped', () => {
  it('is cancelled on stop: no timer is left, and the boundary changes nothing', async () => {
    // Arrange: the board on air at 09:20.
    const { board, timeAndTimers } = await putSundaysBoardOnAirAt0920();

    // Act: stop it, then the clock passes 10:00.
    await board.stopAction({ skipAnimation: true });
    const timersLeft = timeAndTimers.countPendingTimers();
    await timeAndTimers.letTimePass(untilTheEnduroStartsMs);

    // Assert: no timer, and the alignment as it was at the stop.
    expect(timersLeft, 'stop must cancel the check').toBe(0);
    expect(readStatusShownOf(board, 'Alinhamento do enduro'), 'nothing checks off air').toBe(
      'inProgress',
    );
  });

  it('is cancelled on dispose', async () => {
    // Arrange: the board on air at 09:20.
    const { board, timeAndTimers } = await putSundaysBoardOnAirAt0920();

    // Act: dispose it.
    await board.dispose();

    // Assert: no timer left.
    expect(timeAndTimers.countPendingTimers(), 'dispose must cancel the check').toBe(0);
  });

  it('is cancelled when the element leaves the page without dispose', async () => {
    // Arrange: the board on air at 09:20.
    const { board, timeAndTimers } = await putSundaysBoardOnAirAt0920();

    // Act: the renderer takes the element out of the page.
    board.remove();

    // Assert: no timer left.
    expect(timeAndTimers.countPendingTimers(), 'a removed board must not check').toBe(0);
  });

  it('only stores and draws an update off air, booking no check', async () => {
    // Arrange: the board played at 09:20 and stopped.
    const { board, timeAndTimers } = await putSundaysBoardOnAirAt0920();
    await board.stopAction({ skipAnimation: true });

    // Act: the title changes while off air.
    await board.updateAction({ data: { title: 'PROGRAMAÇÃO DE DOMINGO' } });

    // Assert: drawn, and no timer.
    expect(
      board.shadowRoot?.querySelector('[data-testid="sessions-board-title"]')?.textContent,
      'the update is drawn',
    ).toBe('PROGRAMAÇÃO DE DOMINGO');
    expect(timeAndTimers.countPendingTimers(), 'an update off air books no check').toBe(0);
  });
});

describe('an update during the stop-out', () => {
  it('leaves the fading board alone, then draws the update once it has faded', async () => {
    // Arrange: the board on air at 09:20, its stop-out lasting 250 ms (on the board itself,
    // since jsdom carries no custom property from :root into a shadow root), the stop started.
    const { board, timeAndTimers } = await putSundaysBoardOnAirAt0920();
    board.shadowRoot
      ?.querySelector<HTMLElement>('[data-testid="sessions-board"]')
      ?.style.setProperty('--motion-out', '250ms');
    const pendingStop = board.stopAction({});

    // Act: the title changes while the board fades; then the stop-out is ended at once
    // (never waited for: a real motion under fake time may outlast the test's timeout).
    const answer = await board.updateAction({ data: { title: 'PROGRAMAÇÃO DE DOMINGO' } });
    const titleDuringTheStopOut = readTitle(board);
    finishEveryRunningMotionAtOnce();
    await pendingStop;

    // Assert: accepted, the fading board unchanged, the new title drawn once faded, and no
    // check booked off air.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(titleDuringTheStopOut, 'the fading board keeps its title').toBe('PROGRAMAÇÃO DO DIA');
    expect(readTitle(board), 'drawn once faded').toBe('PROGRAMAÇÃO DE DOMINGO');
    expect(timeAndTimers.countPendingTimers(), 'no check off air').toBe(0);
  });
});

describe('an update during the play-in', () => {
  it('leaves the rising board alone, then draws the update once it is up', async () => {
    // Arrange: Sunday's board loaded at 09:20, its play-in lasting 400 ms (on the board
    // itself, since jsdom carries no custom property from :root into a shadow root), the
    // play started and 100 ms into the rise.
    const timeAndTimers = takeControlOfTimeAndTimers(atSundayBrasiliaTime('09:20'));
    const board = createSessionsBoardOnThePage();
    await loadSessionsBoardWithData(board, createSundaySessionsBoardData());
    board.shadowRoot
      ?.querySelector<HTMLElement>('[data-testid="sessions-board"]')
      ?.style.setProperty('--motion-in', '400ms');
    const pendingPlay = board.playAction({});
    await timeAndTimers.letTimePass(100);

    // Act: the title changes while the board rises; then the play-in is ended at once.
    const answer = await board.updateAction({ data: { title: 'PROGRAMAÇÃO DE DOMINGO' } });
    const titleDuringThePlayIn = readTitle(board);
    finishEveryRunningMotionAtOnce();
    await pendingPlay;

    // Assert: accepted, the rising board unchanged, the new title once it is up, and one
    // check booked for the enduro's start.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(titleDuringThePlayIn, 'the rising board keeps its title').toBe('PROGRAMAÇÃO DO DIA');
    expect(readTitle(board), 'drawn once up').toBe('PROGRAMAÇÃO DE DOMINGO');
    expect(timeAndTimers.countPendingTimers(), 'one check booked').toBe(1);
  });
});
