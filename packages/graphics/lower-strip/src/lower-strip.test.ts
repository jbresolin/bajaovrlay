/**
 * The lower strip web component: load, play, update, stop and dispose
 * (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   lower-strip.ts is the OGraf graphic itself: a web component the renderer loads,
 *   plays, updates, stops and disposes, which turns its own pages while on air (the paging
 *   has its own file, lower-strip.paging.test.ts). It draws the kit's clock block, the
 *   page of cars and the page cell.
 *
 * What these tests prove:
 *   - load draws page 1 off air in pt-BR: the clock block ("1:00:00", VERDE), six pills
 *     ("1º 51 FAHOR" first, the leader's position on the green chip) and "1/6".
 *   - Bad data answers 400 naming the field; calls at the wrong moment answer a 4xx with a
 *     pt-BR message, never a throw; stop before play is harmless.
 *   - play brings every piece on air at step 0; play while on air takes it off.
 *   - The play-in cascades the clock block, the six cars and the page cell
 *     `--motion-row-stagger` apart; without the block the cars start it.
 *   - The clock block switched off leaves the cars at the left of the bar; switched on
 *     on air it appears at once in its place.
 *   - A live update on air redraws the page in place: the same pill elements, new texts.
 *   - A block switch that arrives during the stop-out leaves the fading block alone and is
 *     drawn once everything has faded.
 *   - dispose ends a running play-in (409, no tween left), and a dispose during load
 *     wins.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering, fonts and timing; jsdom draws nothing, and unless a test places
 *     tokens every timeline lasts 0 ms. The Playwright suites in e2e/ run the built strip.
 *   - The page timer and turns; lower-strip.paging.test.ts.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createLowerStripOnThePage,
  createRealEnduroStripData,
  findPartOfLowerStrip,
  loadLowerStripWithData,
  readCarNumbersOnAir,
  readCarPillsOnAir,
  readPageCell,
} from './lowerStripOnThePage.testSupport.js';

const alreadyDisposedAnswer = {
  statusCode: 409,
  statusMessage: 'A faixa já foi descartada (dispose).',
};

describe('load', () => {
  it('draws page 1 off air in pt-BR: the clock block, six cars and "1/6"', async () => {
    // Arrange: a strip on the page, never loaded.
    const lowerStrip = createLowerStripOnThePage();

    // Act: load it with the real enduro an hour in.
    const answer = await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());

    // Assert: 200, the block, the first six cars as a viewer reads them, the page cell,
    // and everything waiting invisible for play.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(findPartOfLowerStrip(lowerStrip, 'clock-block-time')?.textContent, 'the time').toBe(
      '1:00:00',
    );
    expect(findPartOfLowerStrip(lowerStrip, 'clock-block-flag-word')?.textContent, 'the flag').toBe(
      'VERDE',
    );
    expect(readCarPillsOnAir(lowerStrip), 'the first page, as a viewer reads it').toEqual([
      '1º 51 FAHOR',
      '2º 10 UFSJ',
      '3º 47 UTFPR-PB',
      '4º 1 FEI',
      '5º 8 UTFPR-CWB',
      '6º 16 UFF-VR',
    ]);
    expect(readPageCell(lowerStrip), 'the page cell').toBe('1/6');
    const leaderPill = findPartOfLowerStrip(lowerStrip, 'lower-strip-car');
    expect(leaderPill?.hasAttribute('data-leader'), 'the leader’s position is the green chip').toBe(
      true,
    );
    expect(leaderPill?.style.opacity, 'a loaded strip must stay off screen until play').toBe('0');
  });

  it('answers 400 with a pt-BR message naming the bad field', async () => {
    // Arrange: a strip, and data whose second car has no school.
    const lowerStrip = createLowerStripOnThePage();
    const data = createRealEnduroStripData();
    const entriesWithoutASchool = [data.entries[0], { position: 2, carNumber: 10 }];

    // Act: load it with that data.
    const answer = await loadLowerStripWithData(lowerStrip, {
      ...data,
      entries: entriesWithoutASchool,
    });

    // Assert: a 400 naming the field, with the car's place in the list.
    expect(answer, 'bad data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "entries[1].schoolName".',
    });
  });
});

describe('calls made at the wrong moment', () => {
  it('answers 409 to playAction before load, without throwing', async () => {
    // Arrange: a strip on the page that was never loaded.
    const lowerStrip = createLowerStripOnThePage();

    // Act: try to play it.
    const answer = await lowerStrip.playAction({});

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'play before load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'A faixa ainda não foi carregada (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded strip that was never played.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());

    // Act: ask it to stop.
    const answer = await lowerStrip.stopAction({});

    // Assert: a plain 200.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load and 404 to any customAction', async () => {
    // Arrange: a strip loaded with the real enduro.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());

    // Act: load it again, and ask for a custom action a control page might guess at.
    const secondLoad = await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    const customAnswer = await lowerStrip.customAction({ id: 'proxima-pagina', payload: {} });

    // Assert: both refused in pt-BR.
    expect(secondLoad, 'a second load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'A faixa já foi carregada (load); crie outra para novos dados.',
    });
    expect(customAnswer, 'an unknown custom action must answer 404').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "proxima-pagina". A faixa não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a strip that was loaded, played and then disposed.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });
    await lowerStrip.dispose();

    // Act: try to play it and to change its flag.
    const playAnswer = await lowerStrip.playAction({ skipAnimation: true });
    const updateAnswer = await lowerStrip.updateAction({ data: { state: 'yellow' } });

    // Assert: both answer "already disposed".
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });
});

describe('playing and stopping', () => {
  it('brings every piece on air at step 0, and takes it off when played again', async () => {
    // Arrange: a loaded strip.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());

    // Act: play it, note the pieces, then play again (past the last step).
    const playAnswer = await lowerStrip.playAction({ skipAnimation: true });
    const opacitiesOnAir = [
      findPartOfLowerStrip(lowerStrip, 'clock-block')?.style.opacity,
      findPartOfLowerStrip(lowerStrip, 'lower-strip-car')?.style.opacity,
      findPartOfLowerStrip(lowerStrip, 'lower-strip-page-cell')?.style.opacity,
    ];
    const secondPlayAnswer = await lowerStrip.playAction({ skipAnimation: true });

    // Assert: on air at step 0 with every piece visible, then off.
    expect(playAnswer, 'play must answer 200 with step 0').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(opacitiesOnAir, 'the block, the cars and the page cell are on air').toEqual([
      '1',
      '1',
      '1',
    ]);
    expect(secondPlayAnswer, 'playing past the last step takes the strip off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(
      findPartOfLowerStrip(lowerStrip, 'lower-strip-page-cell')?.style.opacity,
      'off air again',
    ).toBe('0');
  });

  it('cascades the clock block, the six cars and the page cell --motion-row-stagger apart', async () => {
    // Arrange: a loaded strip with Ardósia's in and stagger placed on the bar itself (jsdom
    // carries no custom property from :root into a shadow root).
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    const bar = findPartOfLowerStrip(lowerStrip, 'lower-strip-bar');
    bar?.style.setProperty('--motion-in', '400ms');
    bar?.style.setProperty('--motion-row-stagger', '30ms');
    const pieces = [
      findPartOfLowerStrip(lowerStrip, 'clock-block'),
      ...(lowerStrip.shadowRoot?.querySelectorAll<HTMLElement>('[data-testid="lower-strip-car"]') ??
        []),
      findPartOfLowerStrip(lowerStrip, 'lower-strip-page-cell'),
    ];

    // Act: start the play-in, let it begin (GSAP lists a timeline's tweens once it plays),
    // read when each piece's rise starts, then end it.
    const pendingPlay = lowerStrip.playAction({});
    await new Promise((resolve) => setTimeout(resolve, 0));
    const startsMs = pieces.map((piece) =>
      Math.round((gsap.getTweensOf(piece ?? [])[0]?.startTime() ?? -1) * 1000),
    );
    await lowerStrip.dispose();
    await pendingPlay;

    // Assert: left to right, 30 ms apart: the block, six cars, the page cell.
    expect(startsMs, 'each piece 30 ms after the one before').toEqual([
      0, 30, 60, 90, 120, 150, 180, 210,
    ]);
  });
});

describe('the clock block switch', () => {
  it('starts the bar with the cars when the block is off', async () => {
    // Arrange: a strip.
    const lowerStrip = createLowerStripOnThePage();

    // Act: load it with the block switched off.
    await loadLowerStripWithData(lowerStrip, {
      ...createRealEnduroStripData(),
      showClockBlock: false,
    });

    // Assert: the bar is marked without the block, and the block is hidden.
    expect(
      findPartOfLowerStrip(lowerStrip, 'lower-strip-bar')?.dataset.clockBlock,
      'the bar is drawn without its block',
    ).toBe('hidden');
    expect(findPartOfLowerStrip(lowerStrip, 'clock-block')?.hidden, 'the block is hidden').toBe(
      true,
    );
  });

  it('shows the block at once in its place when switched on on air', async () => {
    // Arrange: the strip on air without its block.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, {
      ...createRealEnduroStripData(),
      showClockBlock: false,
    });
    await lowerStrip.playAction({ skipAnimation: true });

    // Act: the race clock card goes off air, so the operator switches the block on.
    const answer = await lowerStrip.updateAction({ data: { showClockBlock: true } });

    // Assert: shown and visible, with no re-entry of the rest.
    const block = findPartOfLowerStrip(lowerStrip, 'clock-block');
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(block?.hidden, 'the block is shown').toBe(false);
    expect(block?.style.opacity, 'and visible at once').toBe('1');
  });
});

describe('a live update on air', () => {
  it('redraws the page in place: the same pills with the new order', async () => {
    // Arrange: the strip on air, its first pill noted.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });
    const firstPillBefore = findPartOfLowerStrip(lowerStrip, 'lower-strip-car');

    // Act: cars 51 and 10 trade places, as the positions source sends it.
    const field = createRealEnduroStripData().entries;
    const [leader, second, ...rest] = field;
    const swappedField = [{ ...second, position: 1 }, { ...leader, position: 2 }, ...rest];
    await lowerStrip.updateAction({ data: { entries: swappedField } });

    // Assert: car 10 leads on the same pill element, still on air.
    expect(readCarNumbersOnAir(lowerStrip).slice(0, 2), 'the new order').toEqual([10, 51]);
    expect(
      findPartOfLowerStrip(lowerStrip, 'lower-strip-car'),
      'the pill is rewritten, never rebuilt',
    ).toBe(firstPillBefore);
    expect(firstPillBefore?.style.opacity, 'and stays on air').toBe('1');
  });
});

describe('an update during the stop-out', () => {
  it('leaves the fading block alone, then draws the switch once everything has faded', async () => {
    // Arrange: the strip on air, its stop-out lasting 250 ms (on the bar itself, since jsdom
    // carries no custom property from :root into a shadow root), the stop started.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });
    findPartOfLowerStrip(lowerStrip, 'lower-strip-bar')?.style.setProperty('--motion-out', '250ms');
    const stop = lowerStrip.stopAction({});

    // Act: the race clock card goes up, so the block is switched off while the strip fades;
    // then the stop-out ends.
    const answer = await lowerStrip.updateAction({ data: { showClockBlock: false } });
    const isBlockHiddenDuringTheStopOut = findPartOfLowerStrip(lowerStrip, 'clock-block')?.hidden;
    const barDuringTheStopOut = findPartOfLowerStrip(lowerStrip, 'lower-strip-bar')?.dataset
      .clockBlock;
    await stop;

    // Assert: accepted, the grid left as it was while fading, and the switch drawn after.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(isBlockHiddenDuringTheStopOut, 'the fading block is not hidden mid-fade').toBe(false);
    expect(barDuringTheStopOut, 'the bar keeps its columns while fading').toBe('shown');
    expect(findPartOfLowerStrip(lowerStrip, 'clock-block')?.hidden, 'hidden once faded').toBe(true);
  });
});

describe('dispose', () => {
  it('ends a running play-in and answers the pending play with 409', async () => {
    // Arrange: a loaded strip whose play-in takes 400 ms (placed on the bar itself).
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    findPartOfLowerStrip(lowerStrip, 'lower-strip-bar')?.style.setProperty('--motion-in', '400ms');
    const pendingPlay = lowerStrip.playAction({});

    // Act: dispose in the middle of the animation.
    await lowerStrip.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play settled with "already disposed", and no tween is left.
    const pageCell = findPartOfLowerStrip(lowerStrip, 'lower-strip-page-cell');
    expect(playAnswer, 'a play cut short by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(gsap.getTweensOf(pageCell ?? []), 'dispose must kill every tween').toEqual([]);
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a strip whose load has started but not finished.
    const lowerStrip = createLowerStripOnThePage();
    const pendingLoad = loadLowerStripWithData(lowerStrip, createRealEnduroStripData());

    // Act: dispose before load finishes, then try to play.
    await lowerStrip.dispose();
    const loadAnswer = await pendingLoad;
    const playAnswer = await lowerStrip.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the strip refuses to come back on air.
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed strip must never play again').toEqual(alreadyDisposedAnswer);
  });
});
