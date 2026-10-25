/**
 * Motion tokens read for GSAP (packages/theme)
 *
 * What this module is for:
 *   Every duration, offset and easing of the on-air motion is a CSS custom property in
 *   ardosia/tokens.css (`--motion-*`, `--ease-*`), set on the renderer page's :root. A
 *   graphic's GSAP timelines cannot read CSS by themselves, so `readMotionTokens(element)`
 *   reads the computed style of an element and answers plain numbers (milliseconds, pixels)
 *   and the three easing strings, so motion follows the theme like colours do.
 *
 * What these tests prove:
 *   - Every duration token is answered as a number of milliseconds, the offset as a
 *     number of pixels, and the three ease tokens as the cubic-bezier strings themselves.
 *   - A token that is missing gives 0 (no motion) and the ease gives a usable fallback,
 *     `linear`, so a graphic on a page without the theme still finishes every action.
 *   - A token with a value that is not a number gives 0 too, never NaN and never a throw.
 *
 * What these tests deliberately do not cover:
 *   - The real tokens.css: the values here are set on the element under test with
 *     `style.setProperty`, so the test reads exactly what it set. jsdom's getComputedStyle
 *     answers custom properties set inline on the element itself and inherited from an
 *     ancestor alike; the tests set them on :root, as the renderer page does, and read
 *     them from a child, as a graphic does.
 *   - Turning an ease string into a GSAP ease; gsapEaseOfToken.test.ts covers that.
 */
import { describe, expect, it } from 'vitest';

import { fallbackEase, type MotionTokens, readMotionTokens } from './readMotionTokens.js';

/** The motion tokens of Ardósia, as ardosia/tokens.css declares them. */
const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-row-stagger': '30ms',
  '--motion-lead': '100ms',
  '--motion-swap': '400ms',
  '--motion-flag': '300ms',
  '--motion-strip-page': '300ms',
  '--motion-strip-hold': '7000ms',
  '--motion-cue-hold': '2000ms',
  '--motion-notice-hold': '8000ms',
  '--motion-board-hold': '10000ms',
  '--motion-page-stagger': '15ms',
  '--motion-sponsor-hold': '5000ms',
  '--motion-sponsor-hold-diamante': '8000ms',
  '--motion-sponsor-hold-ouro': '5000ms',
  '--motion-sponsor-hold-prata': '3000ms',
  '--motion-sponsor-hold-apoio': '3000ms',
  '--motion-sponsor-hold-realizacao': '5000ms',
  '--motion-in-offset': '20',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
  '--ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
};

/** What readMotionTokens must answer for the declarations above. */
const ardosiaMotionTokens: MotionTokens = {
  inMs: 400,
  outMs: 250,
  rowStaggerMs: 30,
  leadMs: 100,
  swapMs: 400,
  flagMs: 300,
  stripPageMs: 300,
  stripHoldMs: 7000,
  cueHoldMs: 2000,
  noticeHoldMs: 8000,
  boardHoldMs: 10000,
  pageStaggerMs: 15,
  sponsorHoldMs: 5000,
  sponsorHoldDiamanteMs: 8000,
  sponsorHoldOuroMs: 5000,
  sponsorHoldPrataMs: 3000,
  sponsorHoldApoioMs: 3000,
  sponsorHoldRealizacaoMs: 5000,
  inOffsetPx: 20,
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeIn: 'cubic-bezier(0.7, 0, 0.84, 0)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
};

/**
 * Puts the given tokens on :root (clearing every motion token first, so no test reads
 * what another set) and returns a graphic-like element below it to read them from.
 */
function placeTokensOnRootAndBuildAGraphicElement(declarations: Record<string, string>): Element {
  const root = document.documentElement;
  for (const tokenName of Object.keys(ardosiaMotionTokenDeclarations)) {
    root.style.removeProperty(tokenName);
  }
  for (const [tokenName, value] of Object.entries(declarations)) {
    root.style.setProperty(tokenName, value);
  }
  const graphicElement = document.createElement('baja-graphic-positions-tower');
  document.body.replaceChildren(graphicElement);
  return graphicElement;
}

describe('readMotionTokens', () => {
  it('answers every duration in milliseconds, the offset in pixels and the three eases', () => {
    // Arrange: Ardósia's motion tokens on :root, and a graphic element under it.
    const graphicElement = placeTokensOnRootAndBuildAGraphicElement(ardosiaMotionTokenDeclarations);

    // Act: read the tokens from the graphic, as its timelines do.
    const motionTokens = readMotionTokens(graphicElement);

    // Assert: every token is a plain number or the ease string itself.
    expect(
      motionTokens,
      'durations must be numbers of milliseconds, the offset a number of pixels, the eases their strings',
    ).toEqual(ardosiaMotionTokens);
  });

  it('reads a duration written in seconds as milliseconds and an offset written with px', () => {
    // Arrange: a theme that writes the swap in seconds and the offset with a unit.
    const graphicElement = placeTokensOnRootAndBuildAGraphicElement({
      ...ardosiaMotionTokenDeclarations,
      '--motion-swap': '0.4s',
      '--motion-in-offset': '20px',
    });

    // Act: read the tokens.
    const motionTokens = readMotionTokens(graphicElement);

    // Assert: 0.4s is 400 ms and 20px is 20.
    expect(motionTokens.swapMs, 'a duration in seconds must be turned into milliseconds').toBe(400);
    expect(motionTokens.inOffsetPx, 'an offset written with px must be read as a number').toBe(20);
  });

  it('gives 0 for a missing duration and the linear fallback for a missing ease', () => {
    // Arrange: a page with no theme at all (no token set on :root).
    const graphicElement = placeTokensOnRootAndBuildAGraphicElement({});

    // Act: read the tokens.
    const motionTokens = readMotionTokens(graphicElement);

    // Assert: no motion (every duration 0) and an ease GSAP and CSS both understand.
    expect(motionTokens, 'without a theme every duration must be 0 and every ease linear').toEqual({
      inMs: 0,
      outMs: 0,
      rowStaggerMs: 0,
      leadMs: 0,
      swapMs: 0,
      flagMs: 0,
      stripPageMs: 0,
      stripHoldMs: 0,
      cueHoldMs: 0,
      noticeHoldMs: 0,
      boardHoldMs: 0,
      pageStaggerMs: 0,
      sponsorHoldMs: 0,
      sponsorHoldDiamanteMs: 0,
      sponsorHoldOuroMs: 0,
      sponsorHoldPrataMs: 0,
      sponsorHoldApoioMs: 0,
      sponsorHoldRealizacaoMs: 0,
      inOffsetPx: 0,
      easeOut: fallbackEase,
      easeIn: fallbackEase,
      easeInOut: fallbackEase,
    });
    expect(fallbackEase, 'the fallback ease must be the linear one').toBe('linear');
  });

  it('gives 0 for a token whose value is not a number, never NaN', () => {
    // Arrange: a theme with a typo in two tokens.
    const graphicElement = placeTokensOnRootAndBuildAGraphicElement({
      ...ardosiaMotionTokenDeclarations,
      '--motion-in': 'rápido',
      '--motion-in-offset': 'vinte',
    });

    // Act: read the tokens.
    const motionTokens = readMotionTokens(graphicElement);

    // Assert: the broken tokens read as 0; the rest are untouched.
    expect(motionTokens.inMs, 'a duration that is not a number must read as 0').toBe(0);
    expect(motionTokens.inOffsetPx, 'an offset that is not a number must read as 0').toBe(0);
    expect(motionTokens.outMs, 'the other tokens must still be read').toBe(250);
  });
});
