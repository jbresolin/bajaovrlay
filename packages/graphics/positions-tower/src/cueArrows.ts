/**
 * The ▲ and ▼ drawn in the cue lane after a position change (decision 16 of the context
 * pack): inline SVG triangles as the design's motion demo draws them, coloured by the
 * row's `is-up` / `is-down` class through the theme's `--cue-up` / `--cue-down`, sized
 * by `--cue-width` / `--cue-height` in the styles.
 */
import { svg, type SVGTemplateResult } from 'lit';

import { ptBR } from './ptBR.js';

/** Which way the car went. */
export type CueDirection = 'up' | 'down';

/** The arrow of a direction, named for assistive technology. */
export function renderCueArrow(direction: CueDirection): SVGTemplateResult {
  const name = ptBR.cueArrowNames[direction];
  if (direction === 'up') {
    return svg`<svg class="cue" viewBox="0 0 14 10" role="img" aria-label=${name}>
      <path d="M7 0 14 10H0Z" fill="currentColor" />
    </svg>`;
  }
  return svg`<svg class="cue" viewBox="0 0 14 10" role="img" aria-label=${name}>
    <path d="M0 0h14L7 10Z" fill="currentColor" />
  </svg>`;
}
