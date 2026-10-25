/**
 * Podium animations (packages/graphics/podium)
 *
 * What this module is for:
 *   The podium's head rises in on Entrar, each Próximo raises one card, and everything
 *   lifts out together on stop (the design's motion.md, "Podium"). The GSAP timelines live
 *   here and take every duration, offset and ease from the theme's motion tokens
 *   (`--motion-*`, `--ease-*`), read through `@bajaovrlay/theme/motion`.
 *
 * What these tests prove:
 *   - The head rises `--motion-in-offset` (20 px) over `--motion-in` on `--ease-out`.
 *   - A card rises `--motion-podium-offset` (40 px, twice the usual rise) over
 *     `--motion-in`, ending visible in its place; a rise with several cards starts them
 *     all at 0; a step without the head moves no head.
 *   - The lift-out moves every piece given together, `--motion-in-offset` up over
 *     `--motion-out` on `--ease-in`, ending hidden.
 *   - Hiding a card leaves it invisible (opacity 0, visibility hidden: its room kept) and
 *     40 px below its place, ready to rise; showing one puts it in place, visible.
 *   - On a page without the theme every timeline lasts 0, so every action still ends.
 *
 * What these tests deliberately do not cover:
 *   - What the motion looks like; e2e/podiumLifecycle.e2e.ts watches a card half way up in
 *     Chromium.
 *   - Reading and parsing the tokens; packages/theme tests readMotionTokens.
 */
import { gsapEaseOfToken } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildLiftOutTogetherTimeline,
  buildRiseInTimeline,
  hideCardsAtOnce,
  showCardsAtOnce,
} from './podiumAnimations.js';
import {
  ardosiaMotionTokenDeclarations,
  placeTokensOnTheRoot,
} from './podiumOnThePage.testSupport.js';

/** Builds stand-ins for the head and the three cards, on the page, removed when the test ends. */
function createHeadAndCardsOnThePage() {
  const head = document.createElement('header');
  const cards = [
    document.createElement('div'),
    document.createElement('div'),
    document.createElement('div'),
  ];
  document.body.append(head, ...cards);
  onTestFinished(() => {
    head.remove();
    for (const card of cards) {
      card.remove();
    }
  });
  return { head, cards, tokensSource: document.body };
}

/** Reads each tween of a timeline: what it moves, when it starts, how long, to where, on which curve. */
function describeTweens(timeline: ReturnType<typeof gsap.timeline>) {
  return timeline.getChildren().map((tween) => ({
    targets: 'targets' in tween ? tween.targets() : [],
    startMs: Math.round(tween.startTime() * 1000),
    lengthMs: Math.round(tween.duration() * 1000),
    endY: tween.vars.y,
    endAutoAlpha: tween.vars.autoAlpha,
    ease: tween.vars.ease,
  }));
}

describe('podium timelines with the Ardósia tokens on the page', () => {
  it('raises the head 20 px over --motion-in on Entrar, and a card 40 px', () => {
    // Arrange: the theme's motion tokens on :root, the head and the cards.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const { head, cards, tokensSource } = createHeadAndCardsOnThePage();
    const thirdPlaceCard = cards[2];
    if (thirdPlaceCard === undefined) {
      throw new Error('the stand-ins must hold three cards');
    }

    // Act: build a rise of the head with the 3rd place's card (a play straight to step 1),
    // note where each starts, and read the tweens.
    const timeline = buildRiseInTimeline(tokensSource, { head, cards: [thirdPlaceCard] });
    timeline.progress(0);
    const headStartY = gsap.getProperty(head, 'y');
    const cardStartY = gsap.getProperty(thirdPlaceCard, 'y');
    const tweens = describeTweens(timeline);
    timeline.kill();

    // Assert: the head from 20 px, the card from 40 px, both at 0 over 400 ms on --ease-out,
    // ending visible in place.
    const easeOut = gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-out'] ?? '');
    expect(headStartY, 'the head starts --motion-in-offset below its place').toBe(20);
    expect(cardStartY, 'a card starts --motion-podium-offset below its place').toBe(40);
    expect(tweens, 'both rise together over --motion-in on --ease-out').toEqual([
      { targets: [head], startMs: 0, lengthMs: 400, endY: 0, endAutoAlpha: 1, ease: easeOut },
      {
        targets: [thirdPlaceCard],
        startMs: 0,
        lengthMs: 400,
        endY: 0,
        endAutoAlpha: 1,
        ease: easeOut,
      },
    ]);
  });

  it('moves only the cards of a step, never the head, all starting together', () => {
    // Arrange: the theme's motion tokens on :root, the head and the cards.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const { cards, tokensSource } = createHeadAndCardsOnThePage();

    // Act: build a step that brings two cards (a goto two steps on) and read the tweens.
    const timeline = buildRiseInTimeline(tokensSource, {
      head: undefined,
      cards: cards.slice(0, 2),
    });
    const tweens = describeTweens(timeline);
    timeline.kill();

    // Assert: one tween per card, both from 0; no tween on anything else.
    expect(
      tweens.map((tween) => [tween.targets, tween.startMs]),
      'a step moves its cards only, together',
    ).toEqual([
      [[cards[0]], 0],
      [[cards[1]], 0],
    ]);
  });

  it('lifts every piece out together, 20 px over --motion-out on --ease-in, ending hidden', () => {
    // Arrange: the theme's motion tokens on :root, the head and the cards.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const { head, cards, tokensSource } = createHeadAndCardsOnThePage();

    // Act: build the lift-out of the head and two revealed cards and read it.
    const timeline = buildLiftOutTogetherTimeline(tokensSource, [head, ...cards.slice(1)]);
    const tweens = describeTweens(timeline);
    timeline.kill();

    // Assert: one tween over every piece, at 0, 250 ms, 20 px up, hidden at the end.
    expect(tweens, 'everything leaves together over --motion-out on --ease-in').toEqual([
      {
        targets: [head, ...cards.slice(1)],
        startMs: 0,
        lengthMs: 250,
        endY: -20,
        endAutoAlpha: 0,
        ease: gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-in'] ?? ''),
      },
    ]);
  });

  it('hides a card invisible and 40 px down, keeping its room, and shows one in place', () => {
    // Arrange: the theme's motion tokens on :root and the cards.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const { cards, tokensSource } = createHeadAndCardsOnThePage();
    const [secondPlaceCard, firstPlaceCard] = cards;
    if (secondPlaceCard === undefined || firstPlaceCard === undefined) {
      throw new Error('the stand-ins must hold three cards');
    }

    // Act: hide the 2nd place's card and show the 1st place's.
    hideCardsAtOnce(tokensSource, [secondPlaceCard]);
    showCardsAtOnce([firstPlaceCard]);

    // Assert: the hidden one invisible but laid out, ready below; the shown one in place.
    expect(
      {
        opacity: secondPlaceCard.style.opacity,
        visibility: secondPlaceCard.style.visibility,
        y: gsap.getProperty(secondPlaceCard, 'y'),
      },
      'a hidden card keeps its room (visibility, not display) and waits 40 px below',
    ).toEqual({ opacity: '0', visibility: 'hidden', y: 40 });
    expect(
      { opacity: firstPlaceCard.style.opacity, y: gsap.getProperty(firstPlaceCard, 'y') },
      'a shown card is fully visible in its place',
    ).toEqual({ opacity: '1', y: 0 });
  });
});

describe('podium timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root (nothing was placed), the head and the cards.
    const { head, cards, tokensSource } = createHeadAndCardsOnThePage();

    // Act: build a rise and a lift-out and measure them.
    const riseIn = buildRiseInTimeline(tokensSource, { head, cards });
    const liftOut = buildLiftOutTogetherTimeline(tokensSource, [head, ...cards]);
    const lengthsMs = [riseIn.duration() * 1000, liftOut.duration() * 1000];
    riseIn.kill();
    liftOut.kill();

    // Assert: a missing token reads as 0 ms, never as a timeline that never ends.
    expect(lengthsMs, 'without the theme both timelines must last 0 ms').toEqual([0, 0]);
  });
});
