// Everything about car groups (the fields of a graphic that describe one car, filled by
// choosing the car once, BAJAOVRLAY-66) that @bajaovrlay/shared exports.

// What a field of a car group shows of the car, and one group as the control page uses it.
export {
  type CarFieldMeaning,
  carFieldMeanings,
  CarFieldMeaningSchema,
  type CarGroup,
  CarGroupSchema,
} from './carGroup.js';
// The positions paths a car pick writes, by number or by place, and a path read back.
export {
  buildPathOfCarFieldAtPlace,
  buildPathOfCarFieldChosenByNumber,
  type CarPickOfPath,
  highestPlaceACarCanBePickedAt,
  readCarPickOfPositionsPath,
} from './carGroupPaths.js';
// A manifest's car groups checked against its data schema: the schema and the reading.
export {
  type CarGroupsOfManifestReading,
  ManifestCarGroupsSchema,
  readCarGroupsOfManifest,
} from './carGroupsOfManifest.js';
