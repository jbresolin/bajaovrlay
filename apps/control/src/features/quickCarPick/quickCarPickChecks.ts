/**
 * What the operator typed in "Escolher carros" (BAJAOVRLAY-82), checked before anything is
 * sent: each number box holds the number of a car the positions list (one car per box), or
 * "Pela posição" holds a place a battle can be for. A check that passes gives the picks,
 * one per group, on the item's source and with its "Ao vivo / Congelado"; one that fails
 * gives a pt-BR message per box, shown under it.
 */
import {
  type CarGroup,
  highestPlaceACarCanBePickedAt,
  type PositionEntry,
} from '@bajaovrlay/shared';

import type { CarPickOfGroup } from '@/features/schemaForm';
import { ptBR } from '@/i18n/ptBR';

import type { BattleOfCarGroups } from './carGroupsToPickQuickly';
import { findCarByNumber } from './positionsOfTheSource';
import { readWholeNumberTyped } from './wholeNumberTyped';

const texts = ptBR.quickCarPick;

/** A battle for the Nth place needs a car at N + 1, so the last place offered is the 9th. */
export const highestBattlePlace = highestPlaceACarCanBePickedAt - 1;

/** What every pick is made on, and what the numbers are checked against. */
export type QuickCarPickSource = {
  sourceId: string;
  sourceLabel: string;
  isLive: boolean;
  /** The cars the source lists now, or undefined when it has sent no positions. */
  positions: PositionEntry[] | undefined;
};

/** One box's message: `about` is the group's id, or 'place' for "Pela posição". */
export type ProblemOfQuickCarPick = { about: string; message: string };

/** What a check gives: the picks to write, or the message of each box that is wrong. */
export type QuickCarPickCheck =
  | { status: 'picks'; picksOfGroups: CarPickOfGroup[] }
  | { status: 'problems'; problems: ProblemOfQuickCarPick[] };

/**
 * The message for one number box, or undefined when it holds a car the source lists:
 * empty or not a whole number gets the editor's own message; a number not in the
 * positions (or no positions at all yet) says so, naming the source.
 */
export function findProblemOfCarNumberTyped(
  carGroup: CarGroup,
  carNumberText: string,
  source: QuickCarPickSource,
): string | undefined {
  const carNumber = readWholeNumberTyped(carNumberText);
  if (carNumber === undefined) {
    return ptBR.carGroups.carNumberMissing(carGroup.label);
  }
  if (source.positions === undefined) {
    return texts.noPositionsYet(source.sourceLabel);
  }
  if (findCarByNumber(source.positions, carNumber) === undefined) {
    return texts.carNotInPositions(carNumber, source.sourceLabel);
  }
  return undefined;
}

/**
 * Checks every number box: each a car the positions list, and no car in two boxes (a
 * battle of a car with itself would show one car twice). Passes with one pick by number
 * per group.
 */
export function checkCarNumbersTyped(
  carGroups: CarGroup[],
  carNumberTextOfEachGroup: Record<string, string>,
  source: QuickCarPickSource,
): QuickCarPickCheck {
  const problems: ProblemOfQuickCarPick[] = [];
  const picksOfGroups: CarPickOfGroup[] = [];
  const carNumbersSeen = new Set<string>();

  for (const carGroup of carGroups) {
    const carNumberText = (carNumberTextOfEachGroup[carGroup.id] ?? '').trim();
    const problem = findProblemOfCarNumberTyped(carGroup, carNumberText, source);
    if (problem !== undefined) {
      problems.push({ about: carGroup.id, message: problem });
      continue;
    }
    if (carNumbersSeen.has(carNumberText)) {
      problems.push({ about: carGroup.id, message: texts.sameCarTwice });
      continue;
    }
    carNumbersSeen.add(carNumberText);
    picksOfGroups.push({
      carGroup,
      pick: { pickedBy: 'number', sourceId: source.sourceId, carNumberText, isLive: source.isLive },
    });
  }
  return problems.length > 0
    ? { status: 'problems', problems }
    : { status: 'picks', picksOfGroups };
}

/** The place typed in "Pela posição", or undefined when it is no place from 1 to the 9th. */
export function readBattlePlaceTyped(placeText: string): number | undefined {
  const placeNumber = readWholeNumberTyped(placeText);
  if (placeNumber === undefined) {
    return undefined;
  }
  return placeNumber <= highestBattlePlace ? placeNumber : undefined;
}

/**
 * Checks "Pela posição": the battle for the Nth place sets the car ahead at N and the car
 * behind at N + 1, both by place (the rule of the editor's "Disputa pela Nª posição"), so
 * the card follows whichever cars run there. Refused, like a number box, when the source
 * has sent no positions yet or lists no car at N + 1 now (a field of 6 cars has no battle
 * for the 6th place): a take of such a pair would be refused for a missing required field.
 */
export function checkBattlePlaceTyped(
  battle: BattleOfCarGroups,
  placeText: string,
  source: QuickCarPickSource,
): QuickCarPickCheck {
  const placeNumber = readBattlePlaceTyped(placeText);
  if (placeNumber === undefined) {
    return {
      status: 'problems',
      problems: [{ about: 'place', message: texts.battlePlaceInvalid(highestBattlePlace) }],
    };
  }
  if (source.positions === undefined) {
    return {
      status: 'problems',
      problems: [{ about: 'place', message: texts.noPositionsYet(source.sourceLabel) }],
    };
  }
  const placeOfTheCarBehind = placeNumber + 1;
  if (source.positions.length < placeOfTheCarBehind) {
    return {
      status: 'problems',
      problems: [{ about: 'place', message: texts.noCarAtPlaceNow(placeOfTheCarBehind) }],
    };
  }
  const { sourceId, isLive } = source;
  return {
    status: 'picks',
    picksOfGroups: [
      {
        carGroup: battle.carGroupAhead,
        pick: { pickedBy: 'place', sourceId, placeNumber, isLive },
      },
      {
        carGroup: battle.carGroupBehind,
        pick: { pickedBy: 'place', sourceId, placeNumber: placeOfTheCarBehind, isLive },
      },
    ],
  };
}
