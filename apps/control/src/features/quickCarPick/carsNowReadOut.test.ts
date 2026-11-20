/**
 * The read-out of "Escolher carros" (apps/control)
 *
 * What this module is for:
 *   Under the boxes of "Escolher carros" (BAJAOVRLAY-82), one line names the cars typed
 *   as they run now, from the live positions, so the operator sees the battle before
 *   sending it: "Agora: 6º 47 Carnaúba Baja × 5º 52 Pequi Off-Road".
 *
 * What these tests prove:
 *   - By number: each box's car, in the order of the boxes; a box with no car the source
 *     lists shows "—".
 *   - By place: the cars running at the place typed and right behind it; no place yet
 *     shows "—" twice.
 *
 * What these tests deliberately do not cover:
 *   - Refusing anything: quickCarPickChecks.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildBattleCardGraphic,
  buildBattleCardOfTheLeadersItem,
  buildSlicesWithTheBattleCardOfTheLeaders,
} from '@/features/items/battleCardOfTheLeaders.testSupport';
import { seededSimulatorId } from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { findCarGroupsToPickQuickly } from './carGroupsToPickQuickly';
import { describeBattleOfPlaceTypedNow, describeCarsOfNumbersTypedNow } from './carsNowReadOut';
import { readPositionsOfSourceNow } from './positionsOfTheSource';

/** The simulator's positions at lap 34. */
function readPositionsAtLap34() {
  return readPositionsOfSourceNow(seededSimulatorId, buildSlicesWithTheBattleCardOfTheLeaders());
}

/** The battle card's two car groups. */
function readBattleCardGroups() {
  return (
    findCarGroupsToPickQuickly(buildBattleCardOfTheLeadersItem(), [buildBattleCardGraphic()])
      ?.carGroups ?? []
  );
}

describe('describeCarsOfNumbersTypedNow', () => {
  it('names cars 47 and 52 as they run now', () => {
    // Arrange: 47 ahead and 52 behind, typed.
    const typed = { ahead: '47', behind: '52' };

    // Act: write the read-out.
    const readOut = describeCarsOfNumbersTypedNow(
      readBattleCardGroups(),
      typed,
      readPositionsAtLap34(),
    );

    // Assert: each car with its place and team.
    expect(readOut, 'the read-out must name both cars as they run now').toBe(
      'Agora: 6º 47 Carnaúba Baja × 5º 52 Pequi Off-Road',
    );
  });

  it('shows a dash for a box with no car the source lists', () => {
    // Arrange: 47 ahead, and car 12, which does not race, behind.
    const typed = { ahead: '47', behind: '12' };

    // Act: write the read-out.
    const readOut = describeCarsOfNumbersTypedNow(
      readBattleCardGroups(),
      typed,
      readPositionsAtLap34(),
    );

    // Assert: car 47, then a dash.
    expect(readOut, 'a car the source does not list is shown as a dash').toBe(
      'Agora: 6º 47 Carnaúba Baja × —',
    );
  });
});

describe('describeBattleOfPlaceTypedNow', () => {
  it('names the cars running 3rd and 4th for the battle for 3rd place', () => {
    // Arrange: "3" typed in "Disputa pela posição".
    const placeText = '3';

    // Act: write the read-out.
    const readOut = describeBattleOfPlaceTypedNow(placeText, readPositionsAtLap34());

    // Assert: car 25 runs 3rd and car 78 runs 4th at lap 34.
    expect(readOut, 'the read-out must name the cars at the 3rd and 4th places').toBe(
      'Agora: 3º 25 Bem-te-vi Off-Road × 4º 78 Arara Off-Road',
    );
  });

  it('shows two dashes before a place is typed', () => {
    // Arrange: nothing typed yet.
    const placeText = '';

    // Act: write the read-out.
    const readOut = describeBattleOfPlaceTypedNow(placeText, readPositionsAtLap34());

    // Assert: a dash for each car.
    expect(readOut, 'no place means no cars yet').toBe('Agora: — × —');
  });
});
