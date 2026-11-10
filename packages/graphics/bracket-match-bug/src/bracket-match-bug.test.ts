/**
 * The match bug's OGraf lifecycle (packages/graphics/bracket-match-bug)
 *
 * What this module is for:
 *   bracket-match-bug.ts is the graphic a renderer loads, plays, updates, stops and
 *   disposes. It is fed live from "Chaves › Partida agora" (BAJAOVRLAY-65): another match
 *   "agora", a result, or the match leaving the air reach it as updates while it is on air.
 *
 * What these tests prove:
 *   - Load draws the match off air; play fades it in, stop out, each answering 200.
 *   - Empty data (an empty "agora") loads and plays: the bug is on air and shows nothing.
 *   - An update on air redraws another match in place; one that takes the match off the
 *     air (its fields sent as undefined) leaves the bug on air showing nothing.
 *   - Bad data is refused with 400 naming the field; a second load answers 409, and so does
 *     every action after dispose.
 *
 * What these tests deliberately do not cover:
 *   - What each field means on screen: matchBugModel.test.ts.
 *   - Real rendering, fonts and motion; jsdom draws nothing. The screenshots
 *     (e2e/matchBugScreenshots.e2e.ts) show the bug in a real Chromium.
 */
import { describe, expect, it } from 'vitest';

import {
  createMatchBugOnThePage,
  createQuarterFinal1Data,
  createQuarterFinal2Data,
  findPartOfMatchBug,
  loadMatchBugWithData,
  readShortNamesShown,
} from './matchBugOnThePage.testSupport.js';

describe('load, play and stop', () => {
  it('loads the match off air, fades it in and out', async () => {
    // Arrange: a bug on the page.
    const matchBug = createMatchBugOnThePage();

    // Act: load the first quarter-final, play it, then stop it.
    const loadAnswer = await loadMatchBugWithData(matchBug, createQuarterFinal1Data());
    const opacityAfterLoad = findPartOfMatchBug(matchBug, 'match-bug-panel')?.style.opacity;
    const playAnswer = await matchBug.playAction({});
    const opacityOnAir = findPartOfMatchBug(matchBug, 'match-bug-panel')?.style.opacity;
    const stopAnswer = await matchBug.stopAction({});

    // Assert: 200 at each step, invisible after load, visible on air, both names drawn.
    expect(loadAnswer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(playAnswer, 'play must answer 200 at step 0').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(stopAnswer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect([opacityAfterLoad, opacityOnAir], 'off air after load, seen on air').toEqual(['0', '1']);
    expect(readShortNamesShown(matchBug), 'Corisco on the left, Buffalo on the right').toEqual([
      'Corisco',
      'Buffalo',
    ]);
  });

  it('loads and plays an empty "agora", showing nothing', async () => {
    // Arrange: a bug on the page.
    const matchBug = createMatchBugOnThePage();

    // Act: load it with no data at all and play it.
    const loadAnswer = await loadMatchBugWithData(matchBug, {});
    const playAnswer = await matchBug.playAction({});

    // Assert: both accepted; the panel is hidden and holds no car.
    expect([loadAnswer.statusCode, playAnswer.statusCode], 'an empty slot is a good take').toEqual([
      200, 200,
    ]);
    expect(
      findPartOfMatchBug(matchBug, 'match-bug-panel')?.dataset.hasMatch,
      'the panel must say it has no match',
    ).toBe('false');
    expect(readShortNamesShown(matchBug), 'no car is drawn').toEqual([]);
  });
});

describe('updates on air', () => {
  it('redraws another match "agora" in place', async () => {
    // Arrange: the first quarter-final on air.
    const matchBug = createMatchBugOnThePage();
    await loadMatchBugWithData(matchBug, createQuarterFinal1Data());
    await matchBug.playAction({});

    // Act: "agora" moves to the second quarter-final.
    const updateAnswer = await matchBug.updateAction({ data: createQuarterFinal2Data() });

    // Assert: accepted, still on air, the new cars drawn.
    expect(updateAnswer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(readShortNamesShown(matchBug), 'Pequi and Acauã must replace the first match').toEqual([
      'Pequi',
      'Acauã',
    ]);
    expect(
      findPartOfMatchBug(matchBug, 'match-bug-panel')?.style.opacity,
      'the bug stays on air through the update',
    ).toBe('1');
  });

  it('shows nothing, still on air, once the match leaves the air', async () => {
    // Arrange: the first quarter-final on air.
    const matchBug = createMatchBugOnThePage();
    await loadMatchBugWithData(matchBug, createQuarterFinal1Data());
    await matchBug.playAction({});

    // Act: "agora" is emptied; the renderer sends every field that left as undefined.
    const updateAnswer = await matchBug.updateAction({
      data: {
        roundName: undefined,
        carANumber: undefined,
        carAShortName: undefined,
        carBNumber: undefined,
        carBShortName: undefined,
      },
    });

    // Assert: accepted; no car left, the panel hidden, never a stale match.
    expect(updateAnswer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(readShortNamesShown(matchBug), 'no car may stay on air').toEqual([]);
    expect(
      findPartOfMatchBug(matchBug, 'match-bug-panel')?.dataset.hasMatch,
      'the panel must say it has no match',
    ).toBe('false');
  });
});

describe('refusals', () => {
  it('refuses bad data with 400, naming the field', async () => {
    // Arrange: a bug on the page, and data with a car number of 0.
    const matchBug = createMatchBugOnThePage();
    const badData = { ...createQuarterFinal1Data(), carANumber: 0 };

    // Act: load it.
    const loadAnswer = await loadMatchBugWithData(matchBug, badData);

    // Assert: 400 naming the field.
    expect(loadAnswer, 'bad data must be refused naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "carANumber".',
    });
  });

  it('answers 409 to a second load and to every action after dispose', async () => {
    // Arrange: a loaded bug.
    const matchBug = createMatchBugOnThePage();
    await loadMatchBugWithData(matchBug, createQuarterFinal1Data());

    // Act: load again, then dispose and try to play.
    const secondLoad = await loadMatchBugWithData(matchBug, createQuarterFinal2Data());
    await matchBug.dispose();
    const playAfterDispose = await matchBug.playAction({});

    // Assert: both refused with 409.
    expect(
      [secondLoad.statusCode, playAfterDispose.statusCode],
      'a second load and a play after dispose must be refused',
    ).toEqual([409, 409]);
  });
});
