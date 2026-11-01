// Test support: draft mappings of the Baja app's results API, written only to prove the
// mapping can read it (BAJAOVRLAY-53). The presets themselves are BAJAOVRLAY-54's; these
// live here, in test support, until then. Each is checked as a saved config is checked.
import { type FlexMappingConfig, FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The teams lookup: equipes' teams by number, joined on the entry's `entryKeyPath`. */
function buildTeamsLookup(entryKeyPath: string) {
  return {
    lookupName: 'equipes',
    requestId: 'equipes',
    listPath: 'teams',
    keyPath: 'number',
    entryKeyPath,
  };
}

/** A name read from the teams lookup first, else from the entry's own `fallbackPath`. */
function readFromTeamsElseFrom(targetField: string, lookupPath: string, fallbackPath: string) {
  return {
    targetField,
    firstOf: [{ fromLookup: { lookup: 'equipes', path: lookupPath } }, { fromPath: fallbackPath }],
  };
}

/** The race (corrida.php) as a session and positions, names joined from equipes.php. */
export function buildDraftRaceMappings(): FlexMappingConfig {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'session',
      requestId: 'corrida',
      fields: [
        { targetField: 'sessionId', fromPath: 'prova_id' },
        { targetField: 'eventName', fromPath: 'event_id' },
        { targetField: 'sessionName', fromPath: 'name' },
        { targetField: 'sessionKind', constantValue: 'enduro' },
        {
          targetField: 'state',
          fromPath: 'clock.state',
          transformId: 'mapValues',
          transformParameters: {
            waiting: 'pre',
            running: 'green',
            red_flag: 'red',
            finished: 'finished',
          },
        },
        { targetField: 'clock.clockMode', constantValue: 'elapsed' },
        {
          targetField: 'clock.referenceTimeMs',
          firstOf: [{ fromPath: 'clock.elapsed_ms' }, { constantValue: 0 }],
        },
        { targetField: 'clock.referenceWallClockMs', fromPath: 'clock.server_time_ms' },
        {
          targetField: 'clock.running',
          fromPath: 'clock.state',
          transformId: 'mapValues',
          transformParameters: { table: { running: true, red_flag: true }, otherwiseValue: false },
        },
        { targetField: 'updatedAtMs', fromPollMoment: true },
      ],
    },
    {
      shapeKey: 'positions',
      requestId: 'corrida',
      entriesPath: 'cars',
      lookups: [buildTeamsLookup('number')],
      workOutGapsFromLaps: true,
      fields: [
        { targetField: 'sessionId', fromPath: 'prova_id' },
        { targetField: 'updatedAtMs', fromPollMoment: true },
      ],
      entryFields: [
        // The API's own position is null before a car's first lap; its order is the standings'.
        { targetField: 'position', fromListOrder: true },
        { targetField: 'carNumber', fromPath: 'number' },
        readFromTeamsElseFrom('teamName', 'short_name', 'team'),
        readFromTeamsElseFrom('schoolName', 'school_short', 'school'),
        { targetField: 'laps', fromPath: 'laps' },
        {
          targetField: 'status',
          fromPath: 'status',
          transformId: 'mapValues',
          transformParameters: {
            running: 'running',
            late: 'running',
            stopped: 'stopped',
            in_pit: 'inPit',
            fueling: 'inPit',
            out: 'retired',
          },
        },
        { targetField: 'lastLapMs', fromPath: 'last_lap_ms' },
        { targetField: 'bestLapMs', fromPath: 'best_lap_ms' },
        { targetField: 'pitStops', fromPath: 'pit.stops' },
        { targetField: 'fuelStops', fromPath: 'fueling.stops' },
        { targetField: 'lastPassAtMs', fromPath: 'last_pass_ms' },
      ],
    },
  ]);
}

/** The words the spoilers refusal gives, as the brief writes them. */
export const spoilersRefusalMessage =
  'Resultado com spoilers ativos: a organização esconde as posições agora.';

/**
 * An overall results table (resultado.php) as standings: cells read by column header, the
 * parts of the score from `partHeaders`, names joined from equipes.php, refused during
 * spoilers.
 */
export function buildDraftOverallMappings(partHeaders: string[]): FlexMappingConfig {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'standings',
      requestId: 'resultado',
      entriesPath: 'rows',
      lookups: [buildTeamsLookup('team.number')],
      table: { columnsPath: 'columns', headerPath: 'header', cellsPath: 'cells' },
      scorePartsFromColumns: { headers: partHeaders, valuePath: 'raw' },
      refuseWhen: { path: 'spoilers_active', equals: true, message: spoilersRefusalMessage },
      fields: [
        { targetField: 'scope', constantValue: 'overall' },
        { targetField: 'updatedAtMs', fromPollMoment: true },
      ],
      entryFields: [
        { targetField: 'carNumber', fromPath: 'team.number' },
        readFromTeamsElseFrom('teamName', 'short_name', 'team.name'),
        readFromTeamsElseFrom('schoolName', 'school_short', 'team.school'),
        { targetField: 'points', fromColumn: { header: 'Total', path: 'raw' } },
        { targetField: 'rank', fromPath: 'position' },
        { targetField: 'isDisqualified', fromPath: 'team.disqualified' },
      ],
    },
  ]);
}

/** One side of a bracket match, read from slot `slotIndex` of the match. */
function buildCarRules(side: 'carA' | 'carB', slotIndex: number) {
  return [
    { targetField: `${side}.carNumber`, fromPath: `slots[${slotIndex}].team.number` },
    { targetField: `${side}.teamName`, fromPath: `slots[${slotIndex}].team.short_name` },
    { targetField: `${side}.schoolName`, fromPath: `slots[${slotIndex}].team.school_short` },
    { targetField: `${side}.wins`, fromPath: `slots[${slotIndex}].wins` },
  ];
}

/** A tournament (torneio.php) as brackets: rounds holding matches, pending sides incomplete. */
export function buildDraftTournamentMappings(): FlexMappingConfig {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'brackets',
      requestId: 'torneio',
      entriesPath: 'rounds',
      nestedEntriesPath: 'matches',
      entryIsIncompleteWhen: [
        { path: 'slots[0].type', isOneOf: ['pending', 'unknown'] },
        { path: 'slots[1].type', isOneOf: ['pending', 'unknown'] },
      ],
      fields: [
        { targetField: 'sessionId', fromPath: 'resultado_id' },
        { targetField: 'updatedAtMs', fromPollMoment: true },
      ],
      entryFields: [
        { targetField: 'roundName', fromParent: 'name' },
        {
          targetField: 'roundIsThirdPlace',
          fromParent: 'round',
          transformId: 'mapValues',
          transformParameters: { table: { '-1': true }, otherwiseValue: false },
        },
        { targetField: 'matchId', fromPath: 'match_id', transformId: 'numberToText' },
        { targetField: 'bestOf', fromPath: 'best_of' },
        { targetField: 'winnerCarNumber', fromPath: 'winner' },
        {
          targetField: 'walkover',
          fromPath: 'slots[1].type',
          transformId: 'mapValues',
          transformParameters: { table: { bye: true }, otherwiseValue: false },
        },
        ...buildCarRules('carA', 0),
        ...buildCarRules('carB', 1),
      ],
    },
  ]);
}
