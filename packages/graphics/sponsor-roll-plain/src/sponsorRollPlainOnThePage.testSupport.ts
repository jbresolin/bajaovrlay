/**
 * Test support for the plain sponsor roll's component tests: the element under test, its
 * sponsors, readers for what it shows, and control over timers. No theme token is placed
 * on the page, so every fade lasts 0 ms and a test never waits on real motion; the holds
 * are shared's table (sponsorRollPass.ts), which needs no token.
 */
import { putGsapsFrameLoopToSleep } from '@bajaovrlay/graphics-kit/runningMotions.testSupport';
import { onTestFinished, vi } from 'vitest';

import SponsorRollPlainGraphic from './sponsor-roll-plain.js';
import type { SponsorRollPlainData } from './sponsorRollPlainModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-sponsor-roll-plain-under-test', SponsorRollPlainGraphic);

/**
 * Three sponsors as Cadastros' list gives them: Bosch (Diamante, 8 s), Petrobras (Ouro, on
 * the light plate, 5 s) and SAE Brasil (Realização, 5 s). A pass of 18,4 s.
 */
export function createThreeSponsorsRoll(): SponsorRollPlainData {
  return {
    sponsors: [
      { name: 'Bosch', level: 'diamante', logoUrl: '/media/logo-bosch', logoOnLightPlate: false },
      {
        name: 'Petrobras',
        level: 'ouro',
        logoUrl: '/media/logo-petrobras',
        logoOnLightPlate: true,
      },
      {
        name: 'SAE Brasil',
        level: 'realizacao',
        logoUrl: '/media/logo-sae',
        logoOnLightPlate: false,
      },
    ],
    corner: 'top-left',
  };
}

/** Puts a fresh roll on the page; disposed and removed when the test ends. */
export function createPlainRollOnThePage(): SponsorRollPlainGraphic {
  const roll = document.createElement(
    'baja-sponsor-roll-plain-under-test',
  ) as SponsorRollPlainGraphic;
  document.body.append(roll);
  onTestFinished(async () => {
    await roll.dispose();
    roll.remove();
  });
  return roll;
}

/** Lets the page's pending promise callbacks run (fake timers advance by 0 ms too). */
async function letThePageCatchUp(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

/**
 * Loads the roll the way an OBS renderer does, and lets its logos load as a page with the
 * files would: jsdom loads no image, so each one's load event is fired by hand.
 */
export async function loadPlainRollWithData(roll: SponsorRollPlainGraphic, data: unknown) {
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

/** The sponsor shown now: its level's heading and its logo's name; undefined when none is. */
export function readTheSponsorShown(roll: SponsorRollPlainGraphic) {
  const cells = [
    ...(roll.shadowRoot?.querySelectorAll<HTMLElement>('[data-testid="sponsor-roll-plain-cell"]') ??
      []),
  ];
  const shownCell = cells.find((cell) => cell.style.opacity === '1');
  if (shownCell === undefined) {
    return undefined;
  }
  return {
    heading: shownCell.querySelector('[data-testid="sponsor-roll-plain-heading"]')?.textContent,
    name: shownCell.querySelector('img')?.getAttribute('alt'),
  };
}

/** The names of every sponsor the card holds a cell for, in the order of the pass. */
export function readTheSponsorsOfTheCard(roll: SponsorRollPlainGraphic): string[] {
  const images = [
    ...(roll.shadowRoot?.querySelectorAll<HTMLImageElement>(
      '[data-testid="sponsor-roll-plain-cell"] img',
    ) ?? []),
  ];
  return images.map((image) => image.getAttribute('alt') ?? '');
}

/** The card's inline position, as the kit's screenCornerPosition writes it. */
export function readTheCardsPosition(roll: SponsorRollPlainGraphic) {
  const card = roll.shadowRoot?.querySelector<HTMLElement>(
    '[data-testid="sponsor-roll-plain-card"]',
  );
  return { top: card?.style.top, left: card?.style.left, bottom: card?.style.bottom };
}

/**
 * Fakes the timers from now on, so the test decides when the holds pass. Call it before
 * the roll is made: every timer the graphic starts must be a fake one.
 */
export function takeControlOfTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  return {
    /** The graphic's own pending timers: GSAP's frame loop is put to sleep first. */
    countPendingTimers: () => {
      putGsapsFrameLoopToSleep();
      return vi.getTimerCount();
    },
    letTimePass: (milliseconds: number) => vi.advanceTimersByTimeAsync(milliseconds),
  };
}
