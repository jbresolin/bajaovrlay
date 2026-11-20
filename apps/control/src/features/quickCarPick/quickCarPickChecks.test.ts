/**
 * What the operator typed in "Escolher carros", checked (apps/control)
 *
 * What this module is for:
 *   Before "Prévia" or "No ar" sends anything, "Escolher carros" (BAJAOVRLAY-82) checks the
 *   boxes: by number, each holds a car the positions list, and no car twice; by place,
 *   "Disputa pela posição" holds a place from 1 to 9. A check that passes gives the picks
 *   to write, on the item's source with its "Ao vivo / Congelado"; one that fails gives a
 *   pt-BR message per box.
 *
 * What these tests prove:
 *   - Cars 47 and 52 pass as two picks by number, frozen when the item is frozen.
 *   - Each wrong box gets its own message (table below).
 *   - "Disputa pela 3ª posição" gives the car ahead at the 3rd place and the car behind at
 *     the 4th; a place outside 1 to 9 is refused.
 *
 * What these tests deliberately do not cover:
 *   - The bindings each pick writes: carGroupPicksOfStoredItem.test.ts (features/schemaForm).
 *   - Where the messages show: QuickCarPickBox.test.tsx.
 */
import type { PositionEntry } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildBattleCardGraphic,
  buildBattleCardOfTheLeadersItem,
  buildSlicesWithTheBattleCardOfTheLeaders,
} from '@/features/items/battleCardOfTheLeaders.testSupport';
import { seededSimulatorId } from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { findCarGroupsToPickQuickly } from './carGroupsToPickQuickly';
import { readPositionsOfSourceNow } from './positionsOfTheSource';
import {
  checkBattlePlaceTyped,
  checkCarNumbersTyped,
  type QuickCarPickSource,
} from './quickCarPickChecks';

/** The battle card's two cars and its battle, as "Escolher carros" offers them. */
function readBattleCardOffer() {
  const offer = findCarGroupsToPickQuickly(buildBattleCardOfTheLeadersItem(), [
    buildBattleCardGraphic(),
  ]);
  if (offer?.battle === undefined) {
    throw new Error('the battle card must offer two cars and a battle');
  }
  return { carGroups: offer.carGroups, battle: offer.battle };
}

/** The simulator at lap 34 as the source of the picks, live or frozen. */
function buildSimulatorAsTheSource(isLive: boolean): QuickCarPickSource {
  const positions: PositionEntry[] | undefined = readPositionsOfSourceNow(
    seededSimulatorId,
    buildSlicesWithTheBattleCardOfTheLeaders(),
  );
  return { sourceId: seededSimulatorId, sourceLabel: 'Simulador — Enduro', isLive, positions };
}

describe('checkCarNumbersTyped', () => {
  it('passes cars 47 and 52 as two picks by number, frozen like the item', () => {
    // Arrange: the battle card's boxes, 47 ahead and 52 behind, on a frozen item.
    const { carGroups } = readBattleCardOffer();

    // Act: check the two numbers.
    const check = checkCarNumbersTyped(
      carGroups,
      { ahead: ' 47 ', behind: '52' },
      buildSimulatorAsTheSource(false),
    );

    // Assert: two picks by number, the spaces gone, on the simulator, frozen.
    expect(check.status, 'two cars the simulator lists must pass').toBe('picks');
    const picks = check.status === 'picks' ? check.picksOfGroups.map(({ pick }) => pick) : [];
    expect(picks, 'each box must become a pick by number, frozen like the item').toEqual([
      { pickedBy: 'number', sourceId: seededSimulatorId, carNumberText: '47', isLive: false },
      { pickedBy: 'number', sourceId: seededSimulatorId, carNumberText: '52', isLive: false },
    ]);
  });

  const wrongBoxScenarios = [
    // An empty box: the operator pressed "No ar" before typing the car behind.
    {
      name: 'asks for the car behind when its box is empty',
      typed: { ahead: '47', behind: '' },
      expected: {
        about: 'behind',
        message: 'Digite o número do carro de Carro de trás (um número inteiro, a partir de 1).',
      },
    },
    // Car 12 does not race in this enduro: a typo the read-out alone might not catch.
    {
      name: 'refuses a car the positions do not list, naming the source',
      typed: { ahead: '12', behind: '52' },
      expected: {
        about: 'ahead',
        message: 'O carro 12 não está nas posições de Simulador — Enduro.',
      },
    },
    // The same car in both boxes would show one car battling itself.
    {
      name: 'refuses the same car in both boxes',
      typed: { ahead: '47', behind: '47' },
      expected: { about: 'behind', message: 'Escolha carros diferentes.' },
    },
  ];

  it.each(wrongBoxScenarios)('$name', ({ typed, expected }) => {
    // Arrange: the battle card's boxes.
    const { carGroups } = readBattleCardOffer();

    // Act: check what was typed.
    const check = checkCarNumbersTyped(carGroups, typed, buildSimulatorAsTheSource(true));

    // Assert: one message, under the right box.
    expect(check, 'the wrong box must get its own pt-BR message').toEqual({
      status: 'problems',
      problems: [expected],
    });
  });

  it('says the source has sent no positions yet, rather than refusing the car', () => {
    // Arrange: the simulator with no data at all.
    const { carGroups } = readBattleCardOffer();
    const sourceWithoutPositions = { ...buildSimulatorAsTheSource(true), positions: undefined };

    // Act: check car 47 ahead and 52 behind.
    const check = checkCarNumbersTyped(
      carGroups,
      { ahead: '47', behind: '52' },
      sourceWithoutPositions,
    );

    // Assert: each box says the source has sent nothing yet.
    expect(
      check.status === 'problems' ? check.problems[0]?.message : '',
      'the message must name the source that sent nothing',
    ).toBe('Simulador — Enduro ainda não mandou posições.');
  });
});

describe('checkBattlePlaceTyped', () => {
  it('turns the battle for 3rd place into the 3rd place ahead and the 4th behind', () => {
    // Arrange: the battle card's battle.
    const { battle } = readBattleCardOffer();

    // Act: check "3" typed in "Disputa pela posição".
    const check = checkBattlePlaceTyped(battle, '3', buildSimulatorAsTheSource(true));

    // Assert: two picks by place, 3 and 4, live.
    const picks = check.status === 'picks' ? check.picksOfGroups : [];
    expect(
      picks.map(({ carGroup, pick }) => [carGroup.id, pick]),
      'the car ahead must run 3rd and the car behind 4th',
    ).toEqual([
      ['ahead', { pickedBy: 'place', sourceId: seededSimulatorId, placeNumber: 3, isLive: true }],
      ['behind', { pickedBy: 'place', sourceId: seededSimulatorId, placeNumber: 4, isLive: true }],
    ]);
  });

  it('refuses the 10th place, which has no car with a path of its own behind it', () => {
    // Arrange: the battle card's battle.
    const { battle } = readBattleCardOffer();

    // Act: check "10".
    const check = checkBattlePlaceTyped(battle, '10', buildSimulatorAsTheSource(true));

    // Assert: refused, saying which places can be chosen.
    expect(check, 'only the places 1 to 9 can be battled for').toEqual({
      status: 'problems',
      problems: [{ about: 'place', message: 'Digite uma posição de 1 a 9.' }],
    });
  });
});
