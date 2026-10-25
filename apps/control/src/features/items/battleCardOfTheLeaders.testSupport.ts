// Test support: the battle card of the race's two leaders as the item editor opens it
// during the enduro (BAJAOVRLAY-45): the graphic with its real manifest, the stored item
// whose eleven fields read cars 31 and 38 by number, live, the simulator and its lap-34
// data, and the next polls' data. Every function builds new objects on each call.
import battleCardManifest from '@bajaovrlay/battle-card/battle-card.ograf.json';
import type {
  BindingFieldValue,
  DataSnapshot,
  Graphic,
  Item,
  ServerMessage,
  Slices,
} from '@bajaovrlay/shared';

import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  momentOfTheSamplesMs,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { idOfTheMainSessionRundown } from './itemsLikeTheEditorSaves.testSupport';

/** The leader of the lap-34 sample, and the car right behind it. */
export const leaderCarNumber = 31;
export const secondCarNumber = 38;
/** The 4th car of the sample, which no field of the card reads. */
export const carOffTheCardNumber = 78;

/** The titles the battle card's manifest gives its fields, as the editor labels them. */
export const battleCardFieldLabels = Object.values(battleCardManifest.schema.properties).map(
  (property) => property.title,
);

/** The battle card as the server registers it once its package is built. */
export function buildBattleCardGraphic(): Graphic {
  return {
    id: 'battle-card',
    manifest: structuredClone(battleCardManifest),
    defaultLayerId: 'lower-third',
    category: 'positions',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** One field read live from a car chosen by its number, on the simulator's positions. */
function buildLiveBindingToCar(path: string, carNumber: number): BindingFieldValue {
  return {
    kind: 'binding',
    sourceId: seededSimulatorId,
    shapeKey: 'positions',
    path: `entryOfCar.${path}`,
    carNumber,
    isLive: true,
  };
}

/**
 * "Disputa — líder e 2º", as the operator prepared it: car 31 ahead and car 38 behind,
 * five values each and the gap, all eleven read live; the hand-set trend left empty.
 */
export function buildBattleCardOfTheLeadersItem(): Item {
  return {
    id: '7d2e9a40-3c1b-4f85-b6e2-9a0c4d7f1e53',
    home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
    order: 0,
    graphicId: 'battle-card',
    layerId: 'lower-third',
    fields: {
      aheadPosition: buildLiveBindingToCar('position', leaderCarNumber),
      aheadCarNumber: buildLiveBindingToCar('carNumber', leaderCarNumber),
      aheadTeamName: buildLiveBindingToCar('teamName', leaderCarNumber),
      aheadSchoolName: buildLiveBindingToCar('schoolName', leaderCarNumber),
      aheadLaps: buildLiveBindingToCar('laps', leaderCarNumber),
      behindPosition: buildLiveBindingToCar('position', secondCarNumber),
      behindCarNumber: buildLiveBindingToCar('carNumber', secondCarNumber),
      behindTeamName: buildLiveBindingToCar('teamName', secondCarNumber),
      behindSchoolName: buildLiveBindingToCar('schoolName', secondCarNumber),
      behindLaps: buildLiveBindingToCar('laps', secondCarNumber),
      gapMs: buildLiveBindingToCar('intervalMs', secondCarNumber),
    },
    label: 'Disputa — líder e 2º',
    color: 'neutral',
    notes: '',
  };
}

/** What the server sends at boot: the battle card stored, the simulator with its lap-34 data. */
export function buildSlicesWithTheBattleCardOfTheLeaders(): Slices {
  return {
    ...buildSlicesWithNothingOnAir(),
    graphics: [buildBattleCardGraphic()],
    items: [buildBattleCardOfTheLeadersItem()],
    dataSources: [buildSimulatorThatIsOk()],
    dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
  };
}

/** When the next poll's data arrives: half a second after the lap-34 sample. */
export const momentOfTheNextPollMs = momentOfTheSamplesMs + 500;

/**
 * The lap-34 data half a second later, with one car's interval to the car ahead changed
 * (its gap to the leader too, when it has one in time): what most polls change.
 */
function buildNextPollWithIntervalOf(carNumber: number, intervalMs: number): DataSnapshot {
  const snapshot = buildEnduroSnapshotAtLap34(seededSimulatorId);
  const positions = snapshot.shapes.positions;
  if (positions === undefined) {
    throw new Error('the lap-34 sample must hold positions');
  }
  const entries = positions.entries.map((entry) => {
    if (entry.carNumber !== carNumber) {
      return entry;
    }
    const gapToLeader = entry.gapToLeaderMs === undefined ? {} : { gapToLeaderMs: intervalMs };
    return { ...entry, intervalMs, ...gapToLeader };
  });
  return {
    ...snapshot,
    receivedAtMs: momentOfTheNextPollMs,
    shapes: { ...snapshot.shapes, positions: { ...positions, entries } },
  };
}

/**
 * The message of the next poll in which only car 78, on no field of the card, drops back
 * from car 25: its interval grows from 6 ms to 1,2 s.
 */
export function buildNextPollWhereOnlyACarOffTheCardMoves(): ServerMessage {
  return {
    type: 'dataSnapshot',
    sourceId: seededSimulatorId,
    snapshot: buildNextPollWithIntervalOf(carOffTheCardNumber, 1_206),
    serverNowMs: momentOfTheNextPollMs,
  };
}

/**
 * The message of the next poll in which car 38 closes on the leader: its interval, the
 * card's gap, goes from 19 087 ms to 18 400 ms.
 */
export function buildNextPollWhereTheSecondCarCloses(): ServerMessage {
  return {
    type: 'dataSnapshot',
    sourceId: seededSimulatorId,
    snapshot: buildNextPollWithIntervalOf(secondCarNumber, 18_400),
    serverNowMs: momentOfTheNextPollMs,
  };
}
