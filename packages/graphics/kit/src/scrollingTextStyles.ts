/**
 * The look of a scrolling text box (scrollingTextWhenTooLong.ts, BAJAOVRLAY-55): the box
 * clips its one line, and the text inside is as wide as it needs, so the clock can measure
 * how much is cut off. Each graphic gives the box its width (a fixed column, `flex: 1`, or a
 * `max-width` from the theme); the box must be a block, a flex or grid item, or an
 * inline-block, since `overflow` does nothing on a plain inline element.
 *
 * At rest (fitting, off air, `skipAnimation`, a screenshot) the text is cut at the box's
 * edge with no fade. While it scrolls, and until its return has faded the end out, the box
 * fades both edges over `--motion-text-edge-fade` pixels: the scroll goes that much further
 * so the last letter comes to rest clear of the fade.
 */
import { css } from 'lit';

export const scrollingTextStyles = css`
  .scrolling-text-box {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: clip;
  }

  .scrolling-text {
    display: inline-block;
  }

  .scrolling-text-box[data-scroll-phase='scrolling'],
  .scrolling-text-box[data-scroll-phase='holdingAtEnd'],
  .scrolling-text-box[data-scroll-phase='fadingOutAtEnd'] {
    --scrolling-text-edge-fade: calc(var(--motion-text-edge-fade) * 1px);
    --scrolling-text-edge-fade-mask: linear-gradient(
      to right,
      transparent 0,
      black var(--scrolling-text-edge-fade),
      black calc(100% - var(--scrolling-text-edge-fade)),
      transparent 100%
    );
    /* The prefixed one keeps the fade in a Chromium older than 120 (an older OBS). */
    -webkit-mask-image: var(--scrolling-text-edge-fade-mask);
    mask-image: var(--scrolling-text-edge-fade-mask);
  }

  /* Only on a box in a cycle: a layer per moving text, none for the texts at rest. */
  .scrolling-text-box[data-scroll-phase] .scrolling-text {
    will-change: transform, opacity;
  }
`;
