/**
 * The one line of "Escolher carros" (BAJAOVRLAY-82) that says who the cars typed are now,
 * from the live positions ("Agora: 6º 47 Carnaúba Baja × 7º 30 Jacu Baja"), so the
 * operator sees the battle before sending it. A box not filled with a car the source lists
 * shows "—" in its place; nothing here refuses anything (quickCarPickChecks.ts does).
 */
import type { CarGroup, PositionEntry } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { findCarAtPlace, findCarByNumber } from './positionsOfTheSource';
import { readBattlePlaceTyped } from './quickCarPickChecks';

const texts = ptBR.quickCarPick;
const wholeNumberFromOnePattern = /^[1-9]\d*$/;

/** One car as the read-out names it ("6º 47 Carnaúba Baja"), or "—" for no car. */
function describeCarNow(car: PositionEntry | undefined): string {
  return car === undefined
    ? texts.carNotFoundNow
    : texts.carNow(car.position, car.carNumber, car.teamName);
}

/** The car a number box holds now, or undefined for a box with no car the source lists. */
function findCarOfNumberTyped(
  carNumberText: string,
  positions: PositionEntry[] | undefined,
): PositionEntry | undefined {
  const trimmedText = carNumberText.trim();
  if (positions === undefined || !wholeNumberFromOnePattern.test(trimmedText)) {
    return undefined;
  }
  return findCarByNumber(positions, Number(trimmedText));
}

/** The read-out of "Por número": each box's car now, in the order of the boxes. */
export function describeCarsOfNumbersTypedNow(
  carGroups: CarGroup[],
  carNumberTextOfEachGroup: Record<string, string>,
  positions: PositionEntry[] | undefined,
): string {
  const carTexts = carGroups.map((carGroup) =>
    describeCarNow(findCarOfNumberTyped(carNumberTextOfEachGroup[carGroup.id] ?? '', positions)),
  );
  return texts.readOut(carTexts);
}

/** The read-out of "Pela posição": the cars running at the place typed and right behind it. */
export function describeBattleOfPlaceTypedNow(
  placeText: string,
  positions: PositionEntry[] | undefined,
): string {
  const placeNumber = readBattlePlaceTyped(placeText);
  if (placeNumber === undefined || positions === undefined) {
    return texts.readOut([texts.carNotFoundNow, texts.carNotFoundNow]);
  }
  return texts.readOut([
    describeCarNow(findCarAtPlace(positions, placeNumber)),
    describeCarNow(findCarAtPlace(positions, placeNumber + 1)),
  ]);
}
