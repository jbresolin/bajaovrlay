/**
 * The race clock's DOM: the template Lit draws once, and the functions that afterwards
 * change only text and data attributes in place. Nothing here rebuilds elements, so an
 * update or a clock frame touches only what really changed.
 */
// The clock's text is the kit's (shared/clock's sum and H:MM:SS), so the server, the
// control page's session card and the strip's and ticker's clock block read the same time.
// The flag is drawn as the kit draws it on every clock (the checkered flag wordless).
import { dressElementAsFlag } from '@bajaovrlay/graphics-kit/flagOnAir';
import {
  type FlagState,
  writeRaceClockTimeTextAt,
} from '@bajaovrlay/graphics-kit/raceClockReading';
// The white logo lives in the theme package; Vite bundles a copy into this graphic's
// dist/assets/, so the built clock works from the preview and from the air alike.
import logoAddress from '@bajaovrlay/theme/brand/logo-branca.png';
import { html, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';
import {
  clearFlagBandToggleLeftovers,
  type FlagBandToggle,
  hideIncomingFlagLayer,
  type RaceClockAnimatedElements,
} from './raceClockAnimations.js';
import type { RaceClockData } from './raceClockModel.js';

/** The elements whose text or attributes change after the first render. */
export type RaceClockParts = RaceClockAnimatedElements & {
  sessionName: HTMLElement;
  clockTime: HTMLElement;
  clockCaption: HTMLElement;
  laps: HTMLElement;
  currentFlagLayer: HTMLElement;
  currentFlagLabel: HTMLElement;
  incomingFlagLabel: HTMLElement;
};

/** The race clock's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderRaceClockTemplate(): TemplateResult {
  return html`
    <section class="race-clock-panel" data-testid="race-clock-panel" data-flag-band="shown">
      <header class="head">
        <img
          class="logo"
          src=${logoAddress}
          alt=${ptBR.logoAlternativeText}
          data-testid="race-clock-logo"
        />
        <span class="title" data-testid="race-clock-session-name"></span>
      </header>
      <div class="body">
        <span class="caption" data-testid="race-clock-caption"></span>
        <span class="laps" data-testid="race-clock-laps"></span>
        <span class="time" data-testid="race-clock-time"></span>
      </div>
      <div class="flag-band" data-testid="race-clock-flag-band">
        <div class="flag-layer" data-testid="race-clock-current-flag-layer">
          <span class="flag-word" data-testid="race-clock-flag-label"></span>
        </div>
        <div class="flag-layer incoming-flag-layer" data-testid="race-clock-incoming-flag-layer">
          <span class="flag-word" data-testid="race-clock-incoming-flag-label"></span>
        </div>
      </div>
    </section>
  `;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findRaceClockParts(renderRoot: ParentNode): RaceClockParts {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`race clock part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    panel: findPart('race-clock-panel'),
    sessionName: findPart('race-clock-session-name'),
    clockTime: findPart('race-clock-time'),
    clockCaption: findPart('race-clock-caption'),
    laps: findPart('race-clock-laps'),
    flagBand: findPart('race-clock-flag-band'),
    currentFlagLayer: findPart('race-clock-current-flag-layer'),
    currentFlagLabel: findPart('race-clock-flag-label'),
    incomingFlagLayer: findPart('race-clock-incoming-flag-layer'),
    incomingFlagLabel: findPart('race-clock-incoming-flag-label'),
  };
}

/** Changes an element's text only when it differs, so unchanged frames touch nothing. */
function writeTextIfChanged(element: HTMLElement, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

/** Writes the session title, the clock caption and the leader laps (hidden when absent). */
export function writeSessionCaptionAndLaps(parts: RaceClockParts, data: RaceClockData): void {
  writeTextIfChanged(parts.sessionName, data.sessionName);
  writeTextIfChanged(parts.clockCaption, ptBR.clockModeCaptions[data.clockMode]);
  const laps = data.lapsCompletedByLeader;
  parts.laps.hidden = laps === undefined;
  writeTextIfChanged(parts.laps, laps === undefined ? '' : ptBR.lapsCompletedByLeader(laps));
}

/** Writes the clock time as it is at `nowWallClockMs`; called on every frame while on air. */
export function writeClockTimeAt(
  parts: RaceClockParts,
  data: RaceClockData,
  nowWallClockMs: number,
): void {
  const clockText = writeRaceClockTimeTextAt(data, nowWallClockMs);
  writeTextIfChanged(parts.clockTime, clockText);
}

/** Shows a flag state on the current layer straight away and hides the incoming one. */
export function showFlagStateAtOnce(parts: RaceClockParts, flagState: FlagState): void {
  dressElementAsFlag(parts.currentFlagLayer, parts.currentFlagLabel, flagState);
  hideIncomingFlagLayer(parts);
}

/** Dresses the (still invisible) incoming layer in a new flag state, ready to crossfade in. */
export function prepareIncomingFlagLayer(parts: RaceClockParts, flagState: FlagState): void {
  dressElementAsFlag(parts.incomingFlagLayer, parts.incomingFlagLabel, flagState);
}

/**
 * Shows or hides the flag band straight away: the card's data-flag-band mark is what
 * the styles lower the card by, and the band is hidden from assistive technology when
 * off. Any inline height or opacity a toggle animation left is cleared, so the styles
 * own both again.
 */
export function showFlagBandAtOnce(parts: RaceClockParts, isShown: boolean): void {
  parts.panel.dataset.flagBand = isShown ? 'shown' : 'hidden';
  if (isShown) {
    parts.flagBand.removeAttribute('aria-hidden');
  } else {
    parts.flagBand.setAttribute('aria-hidden', 'true');
  }
  clearFlagBandToggleLeftovers(parts);
}

/**
 * Switches the band at once and answers the card's heights as drawn before and after,
 * which the on-air toggle animates between. Both are 0 where nothing is drawn (jsdom).
 */
export function showFlagBandAtOnceAndMeasureChange(
  parts: RaceClockParts,
  isShown: boolean,
): FlagBandToggle {
  const heightBeforePx = parts.panel.getBoundingClientRect().height;
  showFlagBandAtOnce(parts, isShown);
  const heightAfterPx = parts.panel.getBoundingClientRect().height;
  return { heightBeforePx, heightAfterPx, isShowing: isShown };
}
