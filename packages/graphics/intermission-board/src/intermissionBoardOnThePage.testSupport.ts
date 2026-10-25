/**
 * Test support for the intermission board's component tests: the element under test, the
 * break before the enduro with its optional parts, readers for what it shows, the theme's
 * sponsor holds on the page, and control over time. No motion token is placed on the page,
 * so every timeline lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished, vi } from 'vitest';

import IntermissionBoardGraphic from './intermission-board.js';
import type { IntermissionBoardData, SponsorLineSponsor } from './intermissionBoardModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-intermission-board-under-test', IntermissionBoardGraphic);

/** The enduro's start: Sunday 30 March 2025, 10:00 in Brasília (UTC−3). */
export const enduroStartsAtMs = Date.parse('2025-03-30T10:00:00.000-03:00');

/** 09:36:15, the design's 23:45 before the start. */
export const designsMomentMs = enduroStartsAtMs - (23 * 60 + 45) * 1000;

/** The sponsors of the line: Bosch and Renault (Diamante), five Ouro, SAE Brasil. */
export function createEightSponsors(): SponsorLineSponsor[] {
  const sponsor = (name: string, level: SponsorLineSponsor['level']): SponsorLineSponsor => ({
    name,
    level,
    logoUrl: `/media/logo-${name.toLowerCase()}`,
    logoOnLightPlate: true,
    rollWeight: 5,
  });
  return [
    sponsor('Bosch', 'diamante'),
    sponsor('Renault', 'diamante'),
    sponsor('Certi', 'ouro'),
    sponsor('CNH', 'ouro'),
    sponsor('Himix', 'ouro'),
    sponsor('Horse', 'ouro'),
    sponsor('Marcopolo', 'ouro'),
    sponsor('SAE Brasil', 'realizacao'),
  ];
}

/** The break before the enduro, with the parts asked for. */
export function createBreakBeforeTheEnduro(parts: {
  hasTopFive: boolean;
  hasSponsors: boolean;
}): IntermissionBoardData {
  const data: IntermissionBoardData = {
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
    nextSessionName: 'Enduro de Resistência',
    nextStartsAtMs: enduroStartsAtMs,
  };
  if (parts.hasTopFive) {
    data.topFive = [
      { rank: 1, carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG', points: 921.8 },
      { rank: 2, carNumber: 1, teamName: 'Equipe FEI Baja', schoolName: 'FEI', points: 903.48 },
      {
        rank: 3,
        carNumber: 10,
        teamName: 'Equipe Komiketo Baja',
        schoolName: 'UFSJ',
        points: 891.59,
      },
      { rank: 4, carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB', points: 889.75 },
      { rank: 5, carNumber: 5, teamName: 'Poli Baja', schoolName: 'POLI', points: 811.78 },
    ];
  }
  if (parts.hasSponsors) {
    data.sponsors = createEightSponsors();
  }
  return data;
}

/** Puts Ardósia's sponsor holds on :root, as the renderer page does; removed when the test ends. */
export function placeTheSponsorHoldsOnTheRoot(): void {
  const holds: Record<string, string> = {
    '--motion-sponsor-hold': '5000ms',
    '--motion-sponsor-hold-diamante': '8000ms',
    '--motion-sponsor-hold-ouro': '5000ms',
    '--motion-sponsor-hold-realizacao': '5000ms',
  };
  const root = document.documentElement;
  for (const [tokenName, value] of Object.entries(holds)) {
    root.style.setProperty(tokenName, value);
  }
  onTestFinished(() => {
    for (const tokenName of Object.keys(holds)) {
      root.style.removeProperty(tokenName);
    }
  });
}

/** Puts a fresh board on the page; disposed and removed when the test ends. */
export function createIntermissionBoardOnThePage(): IntermissionBoardGraphic {
  const board = document.createElement(
    'baja-intermission-board-under-test',
  ) as IntermissionBoardGraphic;
  document.body.append(board);
  onTestFinished(async () => {
    await board.dispose();
    board.remove();
  });
  return board;
}

/** Lets the page's pending promise callbacks and timers run once (real timers). */
function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Loads the board the way an OBS renderer does, firing each logo's load event by hand
 * (jsdom loads no image), with the real timers still in place.
 */
export async function loadIntermissionBoardWithData(
  board: IntermissionBoardGraphic,
  data: unknown,
) {
  const pendingLoad = board.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
  await letThePageCatchUp();
  for (const image of board.shadowRoot?.querySelectorAll('img') ?? []) {
    image.dispatchEvent(new Event('load'));
  }
  return pendingLoad;
}

/** Reads the text of one part found by its test id; undefined when absent. */
export function readShownText(board: IntermissionBoardGraphic, testId: string): string | undefined {
  return board.shadowRoot?.querySelector(`[data-testid="${testId}"]`)?.textContent ?? undefined;
}

/** Whether one part is on the board. */
export function isPartDrawn(board: IntermissionBoardGraphic, testId: string): boolean {
  return board.shadowRoot?.querySelector(`[data-testid="${testId}"]`) !== null;
}

/** The sponsor line's page shown now: the heading and the logos' names of the layer on view. */
export function readSponsorLineShown(board: IntermissionBoardGraphic) {
  const headings = [
    ...(board.shadowRoot?.querySelectorAll<HTMLElement>(
      '[data-testid="intermission-line-heading"]',
    ) ?? []),
  ];
  const shownHeading = headings.find((heading) => heading.style.opacity === '1');
  const layer = shownHeading?.closest('.line-layer');
  return {
    heading: shownHeading?.textContent,
    names: [...(layer?.querySelectorAll('img') ?? [])].map((image) => image.getAttribute('alt')),
  };
}

/**
 * Fakes Date, the timers and the animation frames from `startingMomentMs`, so the test
 * decides when time passes; the real ones come back when the test ends.
 */
export function takeControlOfTime(startingMomentMs = designsMomentMs) {
  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.setSystemTime(startingMomentMs);
  onTestFinished(() => {
    vi.useRealTimers();
  });
  return {
    countPendingTimers: () => vi.getTimerCount(),
    letTimePass: (milliseconds: number) => vi.advanceTimersByTimeAsync(milliseconds),
    /**
     * Moves the clock on at once, then lets two frames run: for the count, without running
     * every frame of a long wait (a timer due in the jump does not fire).
     */
    jumpTheClockAndRunAFrame: async (milliseconds: number) => {
      vi.setSystemTime(Date.now() + milliseconds);
      await vi.advanceTimersByTimeAsync(40);
    },
  };
}
