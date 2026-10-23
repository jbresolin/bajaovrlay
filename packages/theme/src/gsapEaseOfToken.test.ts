/**
 * The GSAP ease of an ease token (packages/theme)
 *
 * What this module is for:
 *   The theme's three easings are CSS cubic-bezier curves (`--ease-out`, `--ease-in`,
 *   `--ease-in-out`). GSAP has no cubic-bezier of its own, so `gsapEaseOfToken(value)`
 *   registers the curve with GSAP's CustomEase, once per curve, and answers the name a
 *   timeline passes as `ease`. The curve GSAP runs is then exactly the token's curve, the
 *   same the design demo runs through the Web Animations API.
 *
 * What these tests prove:
 *   - The name answered is one GSAP parses into an ease function, and that function
 *     really follows the curve: the ease-out curve is past half way at half time, the
 *     ease-in curve is not.
 *   - The same curve asked twice is registered once: both calls answer the same name.
 *   - A value that is not a cubic-bezier (the `linear` fallback, a keyword, an empty
 *     string) answers `none`, GSAP's own linear ease, so a timeline never gets a name
 *     GSAP does not know.
 *
 * What these tests deliberately do not cover:
 *   - Reading the token from the page; readMotionTokens.test.ts covers that.
 *   - CustomEase's own maths; GSAP tests it. Here one value per curve is enough to show
 *     the curve was taken from the token and not from a built-in ease.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import { gsapEaseOfToken } from './gsapEaseOfToken.js';

const ardosiaEaseOut = 'cubic-bezier(0.16, 1, 0.3, 1)';
const ardosiaEaseIn = 'cubic-bezier(0.7, 0, 0.84, 0)';

/** Asks GSAP for the ease function behind a name; undefined when GSAP does not know it. */
function parseEaseByName(easeName: string): ((progress: number) => number) | undefined {
  const parsedEase: unknown = gsap.parseEase(easeName);
  if (typeof parsedEase !== 'function') {
    return undefined;
  }
  return parsedEase as (progress: number) => number;
}

describe('gsapEaseOfToken', () => {
  it('answers a name GSAP parses into an ease that follows the token’s curve', () => {
    // Arrange: the two curves of Ardósia, one easing out and one easing in.

    // Act: ask for their GSAP names and for the eases behind them.
    const easeOutName = gsapEaseOfToken(ardosiaEaseOut);
    const easeInName = gsapEaseOfToken(ardosiaEaseIn);
    const easeOut = parseEaseByName(easeOutName);
    const easeIn = parseEaseByName(easeInName);

    // Assert: GSAP knows both names, and each ease behaves like its curve: the ease-out
    // is well past half way at half time, the ease-in is well before it.
    expect(easeOut, 'GSAP must know the ease-out name').toBeTypeOf('function');
    expect(easeIn, 'GSAP must know the ease-in name').toBeTypeOf('function');
    expect(easeOut?.(0.5), 'the ease-out curve must be past half way at half time').toBeGreaterThan(
      0.8,
    );
    expect(
      easeIn?.(0.5),
      'the ease-in curve must be well short of half way at half time',
    ).toBeLessThan(0.3);
    expect(easeOut?.(0), 'every ease must start at 0').toBe(0);
    expect(easeOut?.(1), 'every ease must end at 1').toBe(1);
  });

  it('registers the same curve once: two calls with the same value answer the same name', () => {
    // Arrange: the ease-out curve, as two graphics on the same page would read it, with
    // the spaces written differently by one of them.

    // Act: ask twice.
    const firstName = gsapEaseOfToken(ardosiaEaseOut);
    const secondName = gsapEaseOfToken('cubic-bezier(0.16,1,0.3,1)');

    // Assert: one name for the one curve.
    expect(secondName, 'the same curve must be registered once and keep its name').toBe(firstName);
  });

  const valuesThatAreNotACurve = [
    // The fallback readMotionTokens answers on a page without the theme.
    { name: 'the linear fallback', value: 'linear' },
    // A CSS keyword a theme author might write; GSAP has no such name.
    { name: 'a CSS easing keyword', value: 'ease-in-out' },
    // A token that is missing altogether.
    { name: 'an empty string', value: '' },
    // A cubic-bezier with a number missing, which CustomEase would refuse.
    { name: 'a cubic-bezier with three numbers', value: 'cubic-bezier(0.16, 1, 0.3)' },
  ];

  it.each(valuesThatAreNotACurve)('answers none for $name', ({ value }) => {
    // Arrange: a value that is not a cubic-bezier (from the table above).

    // Act: ask for its GSAP name.
    const easeName = gsapEaseOfToken(value);

    // Assert: GSAP's linear ease, which every timeline accepts.
    expect(easeName, 'a value that is not a cubic-bezier must answer the linear none').toBe('none');
  });
});
