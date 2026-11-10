/**
 * The "a seguir" card's OGraf lifecycle (packages/graphics/bracket-match-card)
 *
 * What this module is for:
 *   bracket-match-card.ts is the graphic a renderer loads, plays, updates, stops and
 *   disposes. It is fed live from "Chaves › Partida a seguir" (BAJAOVRLAY-65): another
 *   match "a seguir", a result, or the match leaving the air reach it as updates.
 *
 * What these tests prove:
 *   - Load draws the match off air; play brings it in, stop takes it out, each 200; a team
 *     without a logo shows its car-number chip.
 *   - Empty data (an empty "a seguir") loads and plays: the card shows nothing.
 *   - An update on air redraws another match in place; one that takes the match off the
 *     air leaves the card on air showing nothing.
 *   - Bad data is refused with 400 naming the field; a second load answers 409, and so does
 *     every action after dispose.
 *
 * What these tests deliberately do not cover:
 *   - What each field means on screen: matchCardModel.test.ts.
 *   - Logos, real rendering, fonts and motion; jsdom loads no image and draws nothing. The
 *     screenshots (e2e/matchCardScreenshots.e2e.ts) show the card with and without logos.
 */
import { describe, expect, it } from 'vitest';

import {
  createMatchCardOnThePage,
  createSemifinal1Data,
  createSemifinal2Data,
  findPartOfMatchCard,
  loadMatchCardWithData,
  readTeamNamesShown,
} from './matchCardOnThePage.testSupport.js';

describe('load, play and stop', () => {
  it('loads the match off air, brings it in and takes it out', async () => {
    // Arrange: a card on the page.
    const matchCard = createMatchCardOnThePage();

    // Act: load the first semifinal, play it, then stop it.
    const loadAnswer = await loadMatchCardWithData(matchCard, createSemifinal1Data());
    const opacityAfterLoad = findPartOfMatchCard(matchCard, 'match-card-panel')?.style.opacity;
    const playAnswer = await matchCard.playAction({});
    const opacityOnAir = findPartOfMatchCard(matchCard, 'match-card-panel')?.style.opacity;
    const stopAnswer = await matchCard.stopAction({});

    // Assert: 200 at each step, invisible after load, seen on air, both teams and chips.
    expect(loadAnswer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(playAnswer, 'play must answer 200 at step 0').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(stopAnswer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect([opacityAfterLoad, opacityOnAir], 'off air after load, seen on air').toEqual(['0', '1']);
    expect(readTeamNamesShown(matchCard), 'Corisco on the left, Piratas on the right').toEqual([
      'Corisco Baja',
      'Kaizen Piratas do Cerrado',
    ]);
    expect(
      findPartOfMatchCard(matchCard, 'match-card-chip-a')?.textContent,
      'a team without a logo shows its car number in its place',
    ).toBe('32');
  });

  it('loads and plays an empty "a seguir", showing nothing', async () => {
    // Arrange: a card on the page.
    const matchCard = createMatchCardOnThePage();

    // Act: load it with no data at all and play it.
    const loadAnswer = await loadMatchCardWithData(matchCard, {});
    const playAnswer = await matchCard.playAction({});

    // Assert: both accepted; the panel says it has no match and holds no team.
    expect([loadAnswer.statusCode, playAnswer.statusCode], 'an empty slot is a good take').toEqual([
      200, 200,
    ]);
    expect(
      findPartOfMatchCard(matchCard, 'match-card-panel')?.dataset.hasMatch,
      'the panel must say it has no match',
    ).toBe('false');
    expect(readTeamNamesShown(matchCard), 'no team is drawn').toEqual([]);
  });
});

describe('updates on air', () => {
  it('redraws another match "a seguir" in place', async () => {
    // Arrange: the first semifinal on air.
    const matchCard = createMatchCardOnThePage();
    await loadMatchCardWithData(matchCard, createSemifinal1Data());
    await matchCard.playAction({});

    // Act: "a seguir" moves to the second semifinal.
    const updateAnswer = await matchCard.updateAction({ data: createSemifinal2Data() });

    // Assert: accepted, the new teams drawn.
    expect(updateAnswer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(readTeamNamesShown(matchCard), 'the second semifinal must replace the first').toEqual([
      'Equipe Cactus Baja',
      'Equipe UFSC Baja',
    ]);
  });

  it('shows nothing, still on air, once the match leaves the air', async () => {
    // Arrange: the first semifinal on air.
    const matchCard = createMatchCardOnThePage();
    await loadMatchCardWithData(matchCard, createSemifinal1Data());
    await matchCard.playAction({});
    const fieldsLeavingTheAir = Object.fromEntries(
      Object.keys(createSemifinal1Data()).map((fieldName) => [fieldName, undefined]),
    );

    // Act: "a seguir" is emptied; the renderer sends every field that left as undefined.
    const updateAnswer = await matchCard.updateAction({ data: fieldsLeavingTheAir });

    // Assert: accepted; no team left, never a stale match.
    expect(updateAnswer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(readTeamNamesShown(matchCard), 'no team may stay on air').toEqual([]);
  });
});

describe('refusals', () => {
  it('refuses bad data with 400, naming the field', async () => {
    // Arrange: a card on the page, and data with wins written as text.
    const matchCard = createMatchCardOnThePage();
    const badData = { ...createSemifinal1Data(), carAWins: 'um' };

    // Act: load it.
    const loadAnswer = await loadMatchCardWithData(matchCard, badData);

    // Assert: 400 naming the field.
    expect(loadAnswer, 'bad data must be refused naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "carAWins".',
    });
  });

  it('answers 409 to a second load and to every action after dispose', async () => {
    // Arrange: a loaded card.
    const matchCard = createMatchCardOnThePage();
    await loadMatchCardWithData(matchCard, createSemifinal1Data());

    // Act: load again, then dispose and try to play.
    const secondLoad = await loadMatchCardWithData(matchCard, createSemifinal2Data());
    await matchCard.dispose();
    const playAfterDispose = await matchCard.playAction({});

    // Assert: both refused with 409.
    expect(
      [secondLoad.statusCode, playAfterDispose.statusCode],
      'a second load and a play after dispose must be refused',
    ).toEqual([409, 409]);
  });
});
