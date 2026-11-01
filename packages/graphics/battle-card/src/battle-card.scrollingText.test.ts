/**
 * The battle card web component: names too long for a car's pill (packages/graphics/battle-card)
 *
 * What this module is for:
 *   Each car's pill shows its team over its school. A long name ("Instituto Federal de
 *   Educação, Ciência e Tecnologia Fluminense - IFF - Campus Itaperuna") would widen the
 *   pill past the title-safe area; the team column stops at `--battle-team-max-width` and
 *   both lines are scrolling boxes of the kit (scrollingTextWhenTooLong.ts). The card runs
 *   one clock for its four texts while on air, and must end it whenever it leaves the air,
 *   or its animations and timers would go on running inside OBS.
 *
 * What these tests prove:
 *   - Both cars' team names and schools are scrolling boxes.
 *   - On air, with every text too long, the card runs exactly one cycle, each text at its
 *     start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's
 *     test support. battleCardLongNames.e2e.ts measures the bound in Chromium.
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type BattleCardGraphic from './battle-card.js';
import {
  createBattleCardOnThePage,
  createImperadorAheadOfFeiData,
  findPartOfBattleCard,
  loadBattleCardWithData,
} from './battleCardOnThePage.testSupport.js';

/** The battle card's scrolling boxes: each car's team name and school. */
function listScrollingBoxes(battleCard: BattleCardGraphic): HTMLElement[] {
  return [
    'battle-card-ahead-team-name',
    'battle-card-ahead-school-name',
    'battle-card-behind-team-name',
    'battle-card-behind-school-name',
  ].map((testId) => {
    const box = findPartOfBattleCard(battleCard, testId);
    if (box === undefined) {
      throw new Error(`the battle card has no "${testId}"`);
    }
    return box;
  });
}

/** Loads the Imperador–FEI battle, every text too long, and takes it on air. */
async function putBattleCardOnAirWithEveryTextTooLong(): Promise<BattleCardGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const battleCard = createBattleCardOnThePage();
  await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
  await battleCard.playAction({ skipAnimation: true });
  return battleCard;
}

describe('the names too long for a car’s pill', () => {
  it("are each car's team name and school, each a scrolling box", async () => {
    // Arrange: the Imperador–FEI battle, not loaded yet.
    const battleCard = createBattleCardOnThePage();

    // Act: load it.
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());

    // Assert: each text sits in a scrolling box, inside the box's one text element.
    const boxes = listScrollingBoxes(battleCard);
    const areScrollingBoxes = boxes.map((box) => box.classList.contains('scrolling-text-box'));
    expect(areScrollingBoxes, 'every text must be a scrolling box').toEqual([
      true,
      true,
      true,
      true,
    ]);
    const textsInTheirTextElement = boxes.map(
      (box) => box.querySelector('.scrolling-text')?.textContent,
    );
    expect(textsInTheirTextElement, 'each box must hold its text in its one text element').toEqual([
      'Imperador',
      'UTFPR-CWB',
      'Equipe FEI Baja',
      'FEI',
    ]);
  });

  it('run on one cycle while on air, each at its start first', async () => {
    // Arrange and act: on air, taken with skipAnimation as a reloaded renderer does.
    const battleCard = await putBattleCardOnAirWithEveryTextTooLong();

    // Assert: one cycle for the whole battle card, every text holding at its start.
    expect(findRunningScrollingTextCycles().length, 'the battle card must run one cycle').toBe(1);
    const phases = new Set(listScrollingBoxes(battleCard).map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the battle card off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (battleCard: BattleCardGraphic) => battleCard.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (battleCard: BattleCardGraphic) => battleCard.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (battleCard: BattleCardGraphic) => {
        battleCard.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the battle card on air, its cycle running.
    const battleCard = await putBattleCardOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(battleCard);

    // Act: the battle card leaves the air this way.
    await takeOffAir(battleCard);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
