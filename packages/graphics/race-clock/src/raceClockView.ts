/**
 * The race clock's DOM: the template Lit draws once, and the functions that afterwards
 * change only text and data-flag-state attributes in place. Nothing here rebuilds
 * elements, so an update or a clock frame touches only what really changed.
 */
// The clock's sum is shared with the server, which must find the same time on screen.
// Only the `/clock` entry is imported: it carries no Zod and nothing else of shared.
import { computeClockTimeMsAtWallClock } from '@bajaovrlay/shared/clock';
import { html, type TemplateResult } from 'lit';

import { formatClockTimeAsHoursMinutesSeconds } from './clockFormatting.js';
import { ptBR } from './ptBR.js';
import { hideIncomingFlagLayer, type RaceClockAnimatedElements } from './raceClockAnimations.js';
import type { FlagState, RaceClockData } from './raceClockModel.js';

/** The elements whose text or flag state changes after the first render. */
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
    <section class="race-clock-panel" data-testid="race-clock-panel">
      <div class="session-row">
        <span class="session-name" data-testid="race-clock-session-name"></span>
      </div>
      <div class="clock-row">
        <span class="clock-time" data-testid="race-clock-time"></span>
        <div class="clock-details">
          <span class="clock-caption" data-testid="race-clock-caption"></span>
          <span class="laps" data-testid="race-clock-laps"></span>
        </div>
      </div>
      <div class="flag-band" data-testid="race-clock-flag-band">
        <div class="flag-layer" data-testid="race-clock-current-flag-layer">
          <span class="flag-label" data-testid="race-clock-flag-label"></span>
        </div>
        <div class="flag-layer incoming-flag-layer" data-testid="race-clock-incoming-flag-layer">
          <span class="flag-label" data-testid="race-clock-incoming-flag-label"></span>
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

/** Writes the session name, the clock caption and the leader laps (hidden when absent). */
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
  const clockTimeMs = computeClockTimeMsAtWallClock(data, nowWallClockMs);
  const clockText = formatClockTimeAsHoursMinutesSeconds(clockTimeMs, data.clockMode);
  writeTextIfChanged(parts.clockTime, clockText);
}

/** Shows a flag state on the current layer straight away and hides the incoming one. */
export function showFlagStateAtOnce(parts: RaceClockParts, flagState: FlagState): void {
  parts.currentFlagLayer.dataset.flagState = flagState;
  writeTextIfChanged(parts.currentFlagLabel, ptBR.flagLabels[flagState]);
  hideIncomingFlagLayer(parts);
}

/** Dresses the (still hidden) incoming layer in a new flag state, ready to wipe in. */
export function prepareIncomingFlagLayer(parts: RaceClockParts, flagState: FlagState): void {
  parts.incomingFlagLayer.dataset.flagState = flagState;
  writeTextIfChanged(parts.incomingFlagLabel, ptBR.flagLabels[flagState]);
}
