/**
 * Test support for the sponsor roll's component tests: the element under test, the 30ª
 * Competição's sponsors, readers for what it shows, the theme's sponsor holds on the page,
 * and control over timers. No motion token is placed on the page, so every timeline lasts
 * 0 ms and a test never waits on real motion; only the holds are set.
 */
import { createThe30thCompetitionSponsors } from '@bajaovrlay/graphics-kit/the30thCompetitionSponsors.testSupport';
import { onTestFinished, vi } from 'vitest';

import SponsorRollGraphic from './sponsor-roll.js';
import type { SponsorRollData, SponsorRollLayout } from './sponsorRollModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-sponsor-roll-under-test', SponsorRollGraphic);

// The 30ª Competição's 17, each logo a /media address: the kit's one copy of the round.
export { createThe30thCompetitionSponsors };

/** The roll of the 17 in a layout, with the enduro's word for the corner. */
export function createThe30thCompetitionRoll(layout: SponsorRollLayout): SponsorRollData {
  return { layout, sponsors: createThe30thCompetitionSponsors(), eventWord: 'ENDURO' };
}

/** Ardósia's sponsor holds, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaSponsorHolds: Record<string, string> = {
  '--motion-sponsor-hold': '5000ms',
  '--motion-sponsor-hold-diamante': '8000ms',
  '--motion-sponsor-hold-ouro': '5000ms',
  '--motion-sponsor-hold-prata': '3000ms',
  '--motion-sponsor-hold-apoio': '3000ms',
  '--motion-sponsor-hold-realizacao': '5000ms',
};

/** Puts Ardósia's sponsor holds on :root, as the renderer page does; removed when the test ends. */
export function placeTheSponsorHoldsOnTheRoot(): void {
  const root = document.documentElement;
  for (const [tokenName, value] of Object.entries(ardosiaSponsorHolds)) {
    root.style.setProperty(tokenName, value);
  }
  onTestFinished(() => {
    for (const tokenName of Object.keys(ardosiaSponsorHolds)) {
      root.style.removeProperty(tokenName);
    }
  });
}

/** Puts a fresh roll on the page; disposed and removed when the test ends. */
export function createSponsorRollOnThePage(): SponsorRollGraphic {
  const roll = document.createElement('baja-sponsor-roll-under-test') as SponsorRollGraphic;
  document.body.append(roll);
  onTestFinished(async () => {
    await roll.dispose();
    roll.remove();
  });
  return roll;
}

/** Lets the page's pending promise callbacks and timers run once (real timers). */
function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Loads the roll the way an OBS renderer does, and lets its logos load as a page with the
 * files would: jsdom loads no image, so each one's load event is fired by hand.
 */
export async function loadSponsorRollWithData(roll: SponsorRollGraphic, data: unknown) {
  const pendingLoad = roll.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
  await letThePageCatchUp();
  for (const image of roll.shadowRoot?.querySelectorAll('img') ?? []) {
    image.dispatchEvent(new Event('load'));
  }
  return pendingLoad;
}

/** Reads the text of one part found by its test id; undefined when absent. */
export function readShownText(roll: SponsorRollGraphic, testId: string): string | undefined {
  return roll.shadowRoot?.querySelector(`[data-testid="${testId}"]`)?.textContent ?? undefined;
}

/** The full screen's head as the test reads it: the level heading and the page line. */
export function readHead(roll: SponsorRollGraphic) {
  return {
    heading: readShownText(roll, 'sponsor-roll-subtitle'),
    pageLine: readShownText(roll, 'sponsor-roll-aside'),
  };
}

/** The names of the sponsors whose tiles are visible now, in reading order. */
export function readNamesOfTheTilesShown(roll: SponsorRollGraphic): string[] {
  const tiles = [
    ...(roll.shadowRoot?.querySelectorAll<HTMLElement>('[data-testid="sponsor-roll-tile"]') ?? []),
  ];
  return tiles
    .filter((tile) => tile.style.opacity === '1')
    .map((tile) => tile.querySelector('img')?.getAttribute('alt') ?? '');
}

/** The corner's sponsor shown now: its heading and its logo's name. */
export function readCornerSponsorShown(roll: SponsorRollGraphic) {
  const cells = [...(roll.shadowRoot?.querySelectorAll<HTMLElement>('.sponsor-cell') ?? [])];
  const shownCell = cells.find((cell) => cell.style.opacity === '1');
  return {
    heading: shownCell?.querySelector('[data-testid="sponsor-roll-cell-heading"]')?.textContent,
    name: shownCell?.querySelector('img')?.getAttribute('alt'),
  };
}

/** Fakes the timers from now on, so the test decides when the holds pass. */
export function takeControlOfTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  return {
    countPendingTimers: () => vi.getTimerCount(),
    letTimePass: (milliseconds: number) => vi.advanceTimersByTimeAsync(milliseconds),
  };
}
