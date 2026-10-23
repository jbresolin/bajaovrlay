/**
 * The three status icons, inline SVG as the design's slateVocabulary.mjs draws them: a P
 * in a square (in the pit), a wrench (broken down), a circle with a slash (out of the
 * race). Shapes only, no <text>, so the glyph stays a glyph; `currentColor`, so the
 * theme's `--status-icon` colours them. Each carries its pt-BR name for assistive
 * technology (decision 14 of the context pack).
 */
import { nothing, svg, type SVGTemplateResult } from 'lit';

import type { PositionStatus } from './positionsTowerModel.js';
import { ptBR } from './ptBR.js';

/** The P in a square. */
function renderPitIcon(name: string): SVGTemplateResult {
  return svg`<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label=${name}>
    <rect x="1.5" y="1.5" width="17" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M7.25 14.75V5.25h3.25a2.6 2.6 0 0 1 0 5.2H7.25" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

/** The wrench. */
function renderWrenchIcon(name: string): SVGTemplateResult {
  return svg`<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label=${name}>
    <path d="M14.5 2.2a4.3 4.3 0 0 0-5.3 5.9L2.7 14.6a1.9 1.9 0 1 0 2.7 2.7l6.5-6.5a4.3 4.3 0 0 0 5.9-5.3l-2.6 2.6-2.4-.9-.9-2.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
  </svg>`;
}

/** The circle with a slash. */
function renderOutOfTheRaceIcon(name: string): SVGTemplateResult {
  return svg`<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label=${name}>
    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M4.6 15.4 15.4 4.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
  </svg>`;
}

/**
 * The icon of a status, or nothing for a status with nothing to say (running, not
 * started). Rendered with Lit's `render` into the row's status cell.
 */
export function renderStatusIcon(status: PositionStatus): SVGTemplateResult | typeof nothing {
  const name = ptBR.statusIconNames[status];
  if (name === undefined) {
    return nothing;
  }
  switch (status) {
    case 'inPit':
      return renderPitIcon(name);
    case 'stopped':
      return renderWrenchIcon(name);
    case 'retired':
    case 'disqualified':
      return renderOutOfTheRaceIcon(name);
    default:
      return nothing;
  }
}
