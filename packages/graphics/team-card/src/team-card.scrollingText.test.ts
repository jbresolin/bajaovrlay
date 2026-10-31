/**
 * The team card web component: texts too long for the card (packages/graphics/team-card)
 *
 * What this module is for:
 *   A team's name and its school with the place line ("Universidade Tecnológica Federal do
 *   Paraná - Cornélio Procópio · Cornélio Procópio · PR") can be wider than the card may
 *   grow (`--lower-third-max-width`). The name and the details line are scrolling boxes of
 *   the kit (scrollingTextWhenTooLong.ts): the card runs one clock for them while on air,
 *   and must end it whenever it leaves the air, or a GSAP timeline would go on running
 *   inside OBS.
 *
 * What these tests prove:
 *   - The team's name and the details line (school, place) are scrolling boxes.
 *   - On air, with every text too long, the card runs exactly one cycle, each text at its
 *     start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's
 *     test support. teamCardLongNames.e2e.ts measures the real thing in Chromium.
 */
import {
  findRunningScrollingTextCycles,
  killScrollingTextCyclesWhenTheTestEnds,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type TeamCardGraphic from './team-card.js';
import {
  createReptilesTeamCardDataWithoutMedia,
  createTeamCardOnThePage,
  findPartOfTeamCard,
  loadTeamCardWithData,
} from './teamCardOnThePage.testSupport.js';

/** The team card's scrolling boxes: the team's name and the details line. */
function listScrollingBoxes(teamCard: TeamCardGraphic): HTMLElement[] {
  return ['team-card-team-name', 'team-card-details'].map((testId) => {
    const box = findPartOfTeamCard(teamCard, testId);
    if (box === undefined) {
      throw new Error(`the team card has no "${testId}"`);
    }
    return box;
  });
}

/** Loads car 7's card, every text too long, and takes it on air. */
async function putTeamCardOnAirWithEveryTextTooLong(): Promise<TeamCardGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  killScrollingTextCyclesWhenTheTestEnds();
  const teamCard = createTeamCardOnThePage();
  await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
  await teamCard.playAction({ skipAnimation: true });
  return teamCard;
}

describe('the texts too long for the card', () => {
  it("are the team's name and the details line, each a scrolling box", async () => {
    // Arrange: car 7's card, not loaded yet.
    const teamCard = createTeamCardOnThePage();

    // Act: load it.
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());

    // Assert: each text sits in a scrolling box, inside the box's one text element.
    const boxes = listScrollingBoxes(teamCard);
    const areScrollingBoxes = boxes.map((box) => box.classList.contains('scrolling-text-box'));
    expect(areScrollingBoxes, 'every text must be a scrolling box').toEqual([true, true]);
    const textsInTheirTextElement = boxes.map(
      (box) => box.querySelector('.scrolling-text')?.textContent,
    );
    expect(textsInTheirTextElement, 'each box must hold its text in its one text element').toEqual([
      'Reptiles Baja PUC-Rio',
      'PUC-Rio·Rio de Janeiro · RJ',
    ]);
  });

  it('run on one cycle while on air, each at its start first', async () => {
    // Arrange and act: on air, taken with skipAnimation as a reloaded renderer does.
    const teamCard = await putTeamCardOnAirWithEveryTextTooLong();

    // Assert: one cycle for the whole card, every text holding at its start.
    expect(findRunningScrollingTextCycles().length, 'the card must run one cycle').toBe(1);
    const phases = new Set(listScrollingBoxes(teamCard).map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the card off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (teamCard: TeamCardGraphic) => teamCard.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (teamCard: TeamCardGraphic) => teamCard.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (teamCard: TeamCardGraphic) => {
        teamCard.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the card on air, its cycle running.
    const teamCard = await putTeamCardOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(teamCard);

    // Act: the card leaves the air this way.
    await takeOffAir(teamCard);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
