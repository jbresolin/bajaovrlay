/**
 * The real field of the 30ª Competição Baja SAE Brasil's enduro: 34 cars in their order at
 * the end, as the positions source sends them (the canonical positions entry, the fields
 * the strip and the tower read). Read from the design's sample data
 * (docs/design/sample-data.json, built from the real results), so the preview, the paging
 * tests and the fit test page through the very field the design measured.
 */
import designSampleData from '../../../../docs/design/sample-data.json';
import type { StripCar } from './lowerStripModel.js';

/** One car of the field as the positions source sends it. */
export type RealEnduroCar = StripCar & { teamName: string; laps: number; status: string };

/** Builds the 34 cars, leader first; a new list on every call. */
export function createRealEnduroField(): RealEnduroCar[] {
  return designSampleData.positions.map((car) => ({
    position: car.position,
    carNumber: car.carNumber,
    teamName: car.teamName,
    schoolName: car.schoolName,
    laps: car.laps,
    status: car.status,
  }));
}
