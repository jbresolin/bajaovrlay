// Test support: the battle card of the race's two leaders (cars 31 and 38 by number, live)
// as a button of the "Atalhos" panel and as a row of the rundown, with the simulator and
// its lap-34 data, for the tests of "Escolher carros" (BAJAOVRLAY-82); and the bindings a
// pick of cars 47 and 52 writes. Every function builds new objects on each call.
import type { BindingFieldValue, Item, ItemFields, Slices } from '@bajaovrlay/shared';

import {
  buildBattleCardGraphic,
  buildBattleCardOfTheLeadersItem,
} from '@/features/items/battleCardOfTheLeaders.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';
import {
  buildSlicesWithShortcutsAndMacros,
  shortcutsPanelId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

/** The label of the battle card, on its button and on its row. */
export const battleCardLabel = 'Disputa — líder e 2º';

/** The battle card as the fourth button of "Atalhos". */
export function buildBattleCardButton(): Item {
  return {
    ...buildBattleCardOfTheLeadersItem(),
    home: { kind: 'quickFire', panelId: shortcutsPanelId },
    order: 3,
  };
}

/** "Atalhos" with its three race-clock buttons and the battle card, and the simulator at lap 34. */
export function buildSlicesWithTheBattleCardButton(): Slices {
  const slices = buildSlicesWithShortcutsAndMacros();
  return {
    ...slices,
    graphics: [...slices.graphics, buildBattleCardGraphic()],
    items: [...slices.items, buildBattleCardButton()],
    dataSources: [buildSimulatorThatIsOk()],
    dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
  };
}

/** The same slices with the battle card on the program output of the lower third. */
export function buildSlicesWithTheBattleCardButtonOnAir(): Slices {
  const slices = buildSlicesWithTheBattleCardButton();
  return {
    ...slices,
    instances: [
      ...slices.instances,
      {
        id: 'instancia-disputa-no-ar',
        graphicId: 'battle-card',
        layerId: 'lower-third',
        target: 'program',
        itemId: buildBattleCardButton().id,
        resolvedData: {},
        currentStep: 0,
        takenAt: '2027-03-20T14:10:00.000Z',
        status: 'on-air',
      },
    ],
  };
}

/** One field read live from the simulator: a car by number, or a place. */
function buildLiveBinding(path: string, carNumber?: number): BindingFieldValue {
  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: seededSimulatorId,
    shapeKey: 'positions',
    path,
    isLive: true,
  };
  if (carNumber !== undefined) {
    binding.carNumber = carNumber;
  }
  return binding;
}

/** The eleven fields of the card with car 47 ahead and car 52 behind, both by number, live. */
export function buildFieldsOfCar47AheadAndCar52Behind(): ItemFields {
  return {
    aheadPosition: buildLiveBinding('entryOfCar.position', 47),
    aheadCarNumber: buildLiveBinding('entryOfCar.carNumber', 47),
    aheadTeamName: buildLiveBinding('entryOfCar.teamName', 47),
    aheadSchoolName: buildLiveBinding('entryOfCar.schoolName', 47),
    aheadLaps: buildLiveBinding('entryOfCar.laps', 47),
    behindPosition: buildLiveBinding('entryOfCar.position', 52),
    behindCarNumber: buildLiveBinding('entryOfCar.carNumber', 52),
    behindTeamName: buildLiveBinding('entryOfCar.teamName', 52),
    behindSchoolName: buildLiveBinding('entryOfCar.schoolName', 52),
    behindLaps: buildLiveBinding('entryOfCar.laps', 52),
    gapMs: buildLiveBinding('entryOfCar.intervalMs', 52),
  };
}

/** The eleven fields of the card as the battle for 3rd place: the 3rd and 4th places, live. */
export function buildFieldsOfTheBattleForThirdPlace(): ItemFields {
  return {
    aheadPosition: buildLiveBinding('entries.2.position'),
    aheadCarNumber: buildLiveBinding('entries.2.carNumber'),
    aheadTeamName: buildLiveBinding('entries.2.teamName'),
    aheadSchoolName: buildLiveBinding('entries.2.schoolName'),
    aheadLaps: buildLiveBinding('entries.2.laps'),
    behindPosition: buildLiveBinding('entries.3.position'),
    behindCarNumber: buildLiveBinding('entries.3.carNumber'),
    behindTeamName: buildLiveBinding('entries.3.teamName'),
    behindSchoolName: buildLiveBinding('entries.3.schoolName'),
    behindLaps: buildLiveBinding('entries.3.laps'),
    gapMs: buildLiveBinding('entries.3.intervalMs'),
  };
}
