// Test support for the button state routes (BAJAOVRLAY-56): the app open to the studio
// network as João runs it for the Ulanzi D200, a race day with a third button on
// "Atalhos" sharing the corner clock's layer, and a GET as the D200 polls it. Every call
// builds new objects; nothing is shared.
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from '../../core/store/raceClockItemOnTheStore.testSupport.js';
import {
  type AppWithTheCommandApi,
  createAppWithTheCommandApi,
  prepareTheRaceDay,
  type RaceDayOnTheStore,
  sendApiRequest,
} from './commandApiOnTheApp.testSupport.js';

/** The race day of prepareTheRaceDay, plus button 3 of "Atalhos". */
export type RaceDayWithTheGreenFlagButton = RaceDayOnTheStore & {
  /** "Bandeira verde no canto": bug layer, button 3 of "Atalhos", next to the corner clock. */
  greenFlagCornerItemId: string;
};

/**
 * Builds the app with BAJAOVRLAY_API_OPEN=true and no token, as the D200 needs, and
 * prepares the race day on it. "Atalhos" then holds, in order: 1 the corner clock (bug
 * layer), 2 the podium (fullscreen layer), 3 "Bandeira verde no canto" (bug layer).
 */
export function createOpenAppWithTheRaceDay(): AppWithTheCommandApi & {
  raceDay: RaceDayWithTheGreenFlagButton;
} {
  const { app, stateStore } = createAppWithTheCommandApi({
    apiTokensVariable: undefined,
    isApiOpenToTheNetwork: true,
  });
  const raceDay = prepareTheRaceDayWithTheGreenFlagButton(stateStore);
  return { app, stateStore, raceDay };
}

/** prepareTheRaceDay, then "Bandeira verde no canto" as button 3 of "Atalhos". */
export function prepareTheRaceDayWithTheGreenFlagButton(
  stateStore: StateStore,
): RaceDayWithTheGreenFlagButton {
  const raceDay = prepareTheRaceDay(stateStore);
  const greenFlagCornerItemId = createRaceClockItemOnTheStore(stateStore, {
    label: 'Bandeira verde no canto',
    layerId: 'bug',
    home: shortcutsPanelHome,
  });
  return { ...raceDay, greenFlagCornerItemId };
}

/**
 * Asks one state route as the D200's status poll does: a GET with no header and no
 * body. Returns the HTTP status and the parsed JSON answer.
 */
export async function askTheStateAsTheD200(
  app: AppWithTheCommandApi['app'],
  path: string,
): Promise<{ httpStatus: number; answer: unknown }> {
  const response = await sendApiRequest(app, { method: 'GET', path });
  return { httpStatus: response.status, answer: await response.json() };
}
