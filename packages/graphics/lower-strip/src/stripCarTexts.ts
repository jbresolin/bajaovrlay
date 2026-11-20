/**
 * The words of a car pill's two optional cells (BAJAOVRLAY-81): the car's laps and its gap
 * to the leader, written from the positions entry's canonical fields as the item asks.
 * Pure: no DOM. An empty text means the cell is not drawn, so a pill only grows by what
 * it really shows. The gap's rule is the tower's (packages/graphics/positions-tower,
 * towerText.ts): laps as "+2 voltas", a time to the tenth, cut, with no unit (the caps face
 * has no lowercase "s"), and nothing for the leader.
 */
// Only the `/raceTimeText` entry is imported: it carries no Zod and nothing else of shared.
import { writeSecondsToTheTenthCutAsText } from '@bajaovrlay/shared/raceTimeText';

import type { StripCar, StripGapDisplay } from './lowerStripModel.js';
import { ptBR } from './ptBR.js';

/** The laps cell: "43 voltas" when the item shows laps and the car has them, else empty. */
export function writeLapsText(car: StripCar, isLapsShown: boolean): string {
  if (!isLapsShown || car.laps === undefined) {
    return '';
  }
  return ptBR.lapsCompleted(car.laps);
}

/**
 * The gap cell, as the item's choice says (see stripGapDisplays in lowerStripModel.ts).
 * The leader shows nothing: there is no gap to oneself. A car on the leader's lap carries
 * no gapToLeaderLaps (the positions shape gives it gapToLeaderMs instead), so "+0 voltas"
 * cannot be written; a car the source sent no gap for shows nothing rather than a guess.
 */
export function writeGapText(car: StripCar, gapDisplay: StripGapDisplay): string {
  const isLeader = car.position === 1;
  if (gapDisplay === 'none' || isLeader) {
    return '';
  }
  const isLapGapAllowed = gapDisplay === 'laps' || gapDisplay === 'lapsAndTime';
  const isTimeGapAllowed = gapDisplay === 'time' || gapDisplay === 'lapsAndTime';
  if (isLapGapAllowed && car.gapToLeaderLaps !== undefined) {
    return ptBR.gapInLaps(car.gapToLeaderLaps);
  }
  if (isTimeGapAllowed && car.gapToLeaderMs !== undefined) {
    return ptBR.gapInSeconds(writeSecondsToTheTenthCutAsText(car.gapToLeaderMs));
  }
  return '';
}
