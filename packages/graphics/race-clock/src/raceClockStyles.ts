/**
 * The race clock's look. Every colour and font is a `--baja-*` CSS custom property with a
 * default, so the renderer's theme can override them from outside the shadow root later
 * (on :root, the stage or the element itself), without rebuilding the graphic.
 *
 * Why the defaults are fallbacks and not `--baja-*` declarations on :host: a value
 * declared on the element always beats an inherited one, so `:host { --baja-brand: ... }`
 * would silently ignore a theme set on :root. Instead :host copies each theme value, or
 * its default when no theme sets it, into a private `--race-clock-*` property that the
 * rules below use. raceClockOnAir.e2e.ts checks a theme on :root reaches the graphic.
 */
import { css } from 'lit';

export const raceClockStyles = css`
  :host {
    /* Theme values: set any --baja-* on :root, an ancestor or the element to override. */
    --race-clock-brand: var(--baja-brand, #f26b1d);
    --race-clock-font-display: var(
      --baja-font-display,
      'Barlow Condensed',
      'Arial Narrow',
      sans-serif
    );
    --race-clock-panel-background: var(--baja-panel-background, rgb(12 15 20 / 92%));
    --race-clock-panel-text: var(--baja-panel-text, #ffffff);
    --race-clock-panel-muted-text: var(--baja-panel-muted-text, #aeb6c2);
    --race-clock-flag-pre-background: var(--baja-flag-pre-background, #4b5563);
    --race-clock-flag-pre-text: var(--baja-flag-pre-text, #ffffff);
    --race-clock-flag-green-background: var(--baja-flag-green-background, #15a34a);
    --race-clock-flag-green-text: var(--baja-flag-green-text, #ffffff);
    --race-clock-flag-yellow-background: var(--baja-flag-yellow-background, #facc15);
    --race-clock-flag-yellow-text: var(--baja-flag-yellow-text, #111111);
    --race-clock-flag-red-background: var(--baja-flag-red-background, #dc2626);
    --race-clock-flag-red-text: var(--baja-flag-red-text, #ffffff);
    --race-clock-flag-checkered-dark: var(--baja-flag-checkered-dark, #111111);
    --race-clock-flag-checkered-light: var(--baja-flag-checkered-light, #f5f5f5);
    --race-clock-flag-finished-background: var(--baja-flag-finished-background, #1f2937);
    --race-clock-flag-finished-text: var(--baja-flag-finished-text, #ffffff);

    /* The graphic covers the whole 1920x1080 stage and places itself in the corner. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .race-clock-panel {
    position: absolute;
    top: 48px;
    left: 64px;
    width: 440px;
    overflow: hidden;
    border-radius: 6px;
    background: var(--race-clock-panel-background);
    color: var(--race-clock-panel-text);
    font-family: var(--race-clock-font-display);
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  .session-row {
    padding: 10px 18px 0;
    border-left: 6px solid var(--race-clock-brand);
  }

  .session-name {
    display: block;
    overflow: hidden;
    font-size: 24px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .clock-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px 8px;
    border-left: 6px solid var(--race-clock-brand);
  }

  .clock-time {
    display: inline-block;
    font-size: 76px;
    font-weight: 700;
    line-height: 1;
    /* Every digit the same width, so the clock never jitters as it counts. */
    font-variant-numeric: tabular-nums;
  }

  .clock-details {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    font-size: 20px;
    font-weight: 500;
    letter-spacing: 0.06em;
  }

  .clock-caption {
    color: var(--race-clock-panel-muted-text);
  }

  .laps {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .flag-band {
    position: relative;
    height: 44px;
    transform-origin: top center;
  }

  .flag-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    padding: 0 18px;
  }

  .incoming-flag-layer {
    /* Hidden until a flag change wipes it in from the left. */
    clip-path: inset(0% 100% 0% 0%);
  }

  .flag-label {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .flag-layer[data-flag-state='pre'] {
    background: var(--race-clock-flag-pre-background);
    color: var(--race-clock-flag-pre-text);
  }

  .flag-layer[data-flag-state='green'] {
    background: var(--race-clock-flag-green-background);
    color: var(--race-clock-flag-green-text);
  }

  .flag-layer[data-flag-state='yellow'] {
    background: var(--race-clock-flag-yellow-background);
    color: var(--race-clock-flag-yellow-text);
  }

  .flag-layer[data-flag-state='red'] {
    background: var(--race-clock-flag-red-background);
    color: var(--race-clock-flag-red-text);
  }

  .flag-layer[data-flag-state='checkered'] {
    background: repeating-conic-gradient(
        var(--race-clock-flag-checkered-dark) 0% 25%,
        var(--race-clock-flag-checkered-light) 0% 50%
      )
      0 0 / 22px 22px;
    color: var(--race-clock-flag-checkered-light);
  }

  /* On the checkered pattern the label sits on a dark plate so it stays readable. */
  .flag-layer[data-flag-state='checkered'] .flag-label {
    padding: 2px 10px;
    border-radius: 3px;
    background: var(--race-clock-flag-checkered-dark);
  }

  .flag-layer[data-flag-state='finished'] {
    background: var(--race-clock-flag-finished-background);
    color: var(--race-clock-flag-finished-text);
  }
`;
