/**
 * Test support for the sessions board's component tests: the element under test, Sunday's
 * schedule, readers for what it shows, and control over time and timers. No theme token is
 * placed on the page here, so every timeline lasts 0 ms and a test never waits on motion.
 */
import { putGsapsFrameLoopToSleep } from '@bajaovrlay/graphics-kit/runningMotions.testSupport';
import { onTestFinished, vi } from 'vitest';

import SessionsBoardGraphic from './sessions-board.js';
import type { SessionsBoardData } from './sessionsBoardModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-sessions-board-under-test', SessionsBoardGraphic);

/** Sunday 30 March 2025 at a time of day in Brasília (UTC−3), in ms. */
export function atSundayBrasiliaTime(hoursAndMinutes: string): number {
  return Date.parse(`2025-03-30T${hoursAndMinutes}:00.000-03:00`);
}

/** Sunday's board as the design draws it: six slots, none with an end of its own. */
export function createSundaySessionsBoardData(): SessionsBoardData {
  const slots: Array<[string, string, string]> = [
    ['abertura', 'Abertura do box', '07:30'],
    ['briefing', 'Briefing das equipes', '08:30'],
    ['alinhamento', 'Alinhamento do enduro', '09:15'],
    ['enduro', 'Enduro de Resistência', '10:00'],
    ['intervalo', 'Intervalo', '14:30'],
    ['premiacao', 'Cerimônia de premiação', '16:00'],
  ];
  return {
    title: 'PROGRAMAÇÃO DO DIA',
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
    slots: slots.map(([slotId, sessionName, startTime]) => ({
      slotId,
      sessionName,
      sessionKind: slotId === 'enduro' ? 'enduro' : 'other',
      startsAtMs: atSundayBrasiliaTime(startTime),
    })),
  };
}

/** Puts a fresh board on the page; disposed and removed when the test ends. */
export function createSessionsBoardOnThePage(): SessionsBoardGraphic {
  const board = document.createElement('baja-sessions-board-under-test') as SessionsBoardGraphic;
  document.body.append(board);
  onTestFinished(async () => {
    await board.dispose();
    board.remove();
  });
  return board;
}

/** Loads the board the way an OBS renderer does: real-time, at 1920x1080. */
export function loadSessionsBoardWithData(board: SessionsBoardGraphic, data: unknown) {
  return board.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Every row on the board, top to bottom. */
function findRows(board: SessionsBoardGraphic): HTMLElement[] {
  return [
    ...(board.shadowRoot?.querySelectorAll<HTMLElement>('[data-testid="sessions-board-row"]') ??
      []),
  ];
}

/** Each row as the test reads it: its time, session, and the state whose layer shows. */
export function readRows(board: SessionsBoardGraphic) {
  return findRows(board).map((row) => {
    const shownLayer = [...row.querySelectorAll<HTMLElement>('.status-layer')].find(
      (layer) => layer.style.opacity === '1',
    );
    return {
      time: row.querySelector('[data-testid="sessions-board-time"]')?.textContent,
      session: row.querySelector('[data-testid="sessions-board-session"]')?.textContent,
      statusShown: shownLayer?.dataset.status,
    };
  });
}

/** The state shown on the row of one slot, by its session. */
export function readStatusShownOf(
  board: SessionsBoardGraphic,
  session: string,
): string | undefined {
  return readRows(board).find((row) => row.session === session)?.statusShown;
}

/** Whether a row's denser slate (the slot in progress) shows. */
export function isLiveSlateShownOn(board: SessionsBoardGraphic, session: string): boolean {
  const row = findRows(board).find(
    (candidate) =>
      candidate.querySelector('[data-testid="sessions-board-session"]')?.textContent === session,
  );
  return (
    row?.querySelector<HTMLElement>('[data-testid="sessions-board-live-slate"]')?.style.opacity ===
    '1'
  );
}

/**
 * Fakes the clock and the timers from `startingMomentMs`, so the test decides when time
 * passes; the real ones come back when the test ends.
 */
export function takeControlOfTimeAndTimers(startingMomentMs: number) {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(startingMomentMs);
  onTestFinished(() => {
    vi.useRealTimers();
  });
  return {
    /** How many timers are pending: the board's status check, or none. */
    /** The graphic's own pending timers: GSAP's frame loop is put to sleep first. */
    countPendingTimers: () => {
      putGsapsFrameLoopToSleep();
      return vi.getTimerCount();
    },
    /** Lets time pass, running every timer due, and the promises they start. */
    letTimePass: (milliseconds: number) => vi.advanceTimersByTimeAsync(milliseconds),
  };
}
