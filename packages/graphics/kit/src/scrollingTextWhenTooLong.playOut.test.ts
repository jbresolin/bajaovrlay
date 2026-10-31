/**
 * Long text scrolls inside its box: leaving the air (packages/graphics/kit)
 *
 * What this module is for:
 *   When a graphic is taken off air it plays its exit (a fade, a lift) for a few hundred
 *   milliseconds. A scrolling text must stay where it is through that exit: snapping it
 *   back to its start mid-exit is a visible jump (gate 2 of PR #36). So the graphic holds
 *   its texts when the stop begins and stops the clock once its play-out has ended.
 *
 * What these tests prove:
 *   - Held for the play-out, every text's animation is paused where it stands, not
 *     cancelled; its box keeps its phase (and so its fade); no timer of the cycle is left.
 *   - Stopped after the play-out, every text is back at its start and no cycle is left.
 *   - Taken on air again during the play-out, the clock starts afresh, and the stop that
 *     comes when the old play-out ends leaves the new cycle alone.
 *
 * What these tests deliberately do not cover:
 *   - Real layout, time and animations, as in scrollingTextWhenTooLong.test.ts: the widths
 *     are set by hand, the timers run on fake time and the calls to `animate` are recorded.
 *   - Each graphic's own stopAction; the tower's test proves one graphic wires it so.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  addTeamNameBox,
  createGraphicHostWithShadowRoot,
  installHandDrivenResizeObserver,
  letTheCycleRunFor,
  readAnimationOf,
  startClockOverGraphic,
  takeControlOfTimeAndAnimations,
} from './scrollingTextClock.testSupport.js';
import { findRunningScrollingTextCycles } from './scrollingTextOnAir.testSupport.js';

/** The longest name of all: 876 px in a 300 px box, 600 px to scroll, 10 s. */
const iffItaperuna =
  'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA';

describe('a graphic leaving the air', () => {
  it('holds every text where it stands through the play-out', () => {
    // Arrange: two tower rows 4 s into a cycle, both scrolling.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    const clock = startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);

    // Act: the stop begins; the play-out is still running.
    clock.holdTheTextsForThePlayOut();

    // Assert: paused, not cancelled, phases (and fades) kept, no timer left to move them.
    for (const { box, text } of [tucano, iff]) {
      const animation = readAnimationOf(text);
      expect(animation.isPaused, 'the text must stop where it stands').toBe(true);
      expect(animation.isCancelled, 'the text must not jump back to its start').toBe(false);
      expect(box.dataset.scrollPhase, 'the box keeps its phase and its fade').toBe('scrolling');
    }
    expect(vi.getTimerCount(), 'no phase change or next cycle may come during the exit').toBe(0);
  });

  it('puts every text back at its start once the play-out has ended', () => {
    // Arrange: a row scrolling, held for the play-out.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    const clock = startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);
    clock.holdTheTextsForThePlayOut();

    // Act: the play-out has ended; the graphic stops the clock.
    clock.stopAfterThePlayOut();

    // Assert: the text is at rest, off air, with no cycle left running.
    expect(readAnimationOf(iff.text).isCancelled, 'the text must be back at its start').toBe(true);
    expect(iff.box.dataset.scrollPhase, 'the box must name no phase, so no fade').toBe(undefined);
    expect(findRunningScrollingTextCycles(), 'no cycle may be left after the stop').toEqual([]);
  });

  it('starts afresh when taken on air again during the play-out, and keeps the new cycle', () => {
    // Arrange: a row scrolling, held for a play-out that is still running.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    const clock = startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);
    clock.holdTheTextsForThePlayOut();
    const heldAnimation = readAnimationOf(iff.text);

    // Act: the operator takes the graphic again; then the old play-out ends.
    clock.start();
    const newAnimation = readAnimationOf(iff.text);
    clock.stopAfterThePlayOut();

    // Assert: the held text was put to rest, the new cycle runs and the late stop left it.
    expect(heldAnimation.isCancelled, 'the held animation must give way').toBe(true);
    expect(newAnimation, 'a new cycle must start').not.toBe(heldAnimation);
    expect(newAnimation.isCancelled, 'the late stop must leave the new cycle alone').toBe(false);
    expect(iff.box.dataset.scrollPhase, 'the text holds at its start again').toBe('holdingAtStart');
  });
});
