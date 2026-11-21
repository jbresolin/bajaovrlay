/**
 * The real field of the 30ª Competição Baja SAE Brasil's enduro: 34 cars in their order at
 * the end, as the positions source sends them (the canonical positions entry, the fields
 * the strip and the tower read, the laps behind the leader included). Read from the
 * design's sample data (docs/design/sample-data.json, built from the real results), so the
 * preview, the paging tests and the fit test page through the very field the design
 * measured.
 */
import designSampleData from '../../../../docs/design/sample-data.json';
import type { StripCar } from './lowerStripModel.js';

/** One car of the field as the positions source sends it. */
export type RealEnduroCar = StripCar & { teamName: string; laps: number; status: string };

/**
 * Builds the 34 cars, leader first; a new list on every call. Each car behind the leader
 * carries its laps behind as `gapToLeaderLaps` (BAJAOVRLAY-81), as the positions shape
 * does for a lapped car: the race is over, so every car of this field is lapped but the
 * leader. None is on the leader's lap, so none carries a gap in time.
 */
export function createRealEnduroField(): RealEnduroCar[] {
  const leaderLaps = designSampleData.positions[0]?.laps ?? 0;
  return designSampleData.positions.map((car) => {
    const lapsBehindTheLeader = leaderLaps - car.laps;
    const realCar: RealEnduroCar = {
      position: car.position,
      carNumber: car.carNumber,
      teamName: car.teamName,
      schoolName: car.schoolName,
      laps: car.laps,
      status: car.status,
    };
    if (lapsBehindTheLeader > 0) {
      realCar.gapToLeaderLaps = lapsBehindTheLeader;
    }
    return realCar;
  });
}
