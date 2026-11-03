/**
 * The Baja app presets (BAJAOVRLAY-54): the flex configs that read the Baja app's public
 * results API (`docs/results-api.md` in the Baja app repo), one per kind of answer. Each is
 * a JSON file beside this one, written as an operator would export it, with `{{name}}`
 * where a parameter goes: the API's address, the event id and the prova or resultado id,
 * and for a table its points column and scope. These functions fill them in and check the
 * result as a saved config is checked, so a broken preset fails here and never on Fontes.
 * Nothing in the mapping code knows these words; only the JSON files do.
 */
import type { StandingsScope } from '../../../dataShapes/standingsShape.js';
import { type HttpJsonConfig, HttpJsonConfigSchema } from '../../../dataSources/httpJsonConfig.js';
import { fillPresetPlaceholders, type PresetParameterValues } from '../presetPlaceholders.js';
import racePreset from './corrida.preset.json' with { type: 'json' };
import resultsTablePreset from './resultado.preset.json' with { type: 'json' };
import tournamentPreset from './torneio.preset.json' with { type: 'json' };

/** The Baja app's public results API, the address the presets read unless told otherwise. */
export const bajaAppApiAddress = 'https://api.bajasaebrasil.net';

/**
 * What a simulated race is refused with until "Aceitar corrida simulada" is ticked: the
 * race preset's positions refuse it, its session refuses a clock state it does not know.
 */
export const simulatedRaceRefusalMessage = readRefusalMessageOfShape(racePreset, 'positions');

/** What a results table is refused with while its organisers hide the positions. */
export const spoilersRefusalMessage = readRefusalMessageOfShape(resultsTablePreset, 'standings');

/**
 * The score parts the results table preset proposes: the overall table's ("Geral"), as
 * the preset file lists them. The page ticks those a chosen table has.
 */
export const proposedScorePartHeaders: readonly string[] =
  resultsTablePreset.mappings[0]?.scorePartsFromColumns.headers ?? [];

/** Where every preset reads: the API's address, and the event. */
type BajaAppAddressParameters = {
  /** The API's address, `https://api.bajasaebrasil.net`, or a local copy of it. */
  apiAddress: string;
  /** The event, as the Baja app names it: "26BR". */
  eventId: string;
};

/** The race preset's parameters. */
export type BajaAppRaceParameters = BajaAppAddressParameters & {
  /** The lap-counted prova: "END". */
  provaId: string;
  /** "Aceitar corrida simulada": a race the API marks as a simulation is mapped too. */
  acceptsSimulatedRace: boolean;
};

/** The results table preset's parameters. */
export type BajaAppResultsTableParameters = BajaAppAddressParameters & {
  /** The table: "26BR_GER". */
  resultadoId: string;
  /** The column the table ranks by (its `ranking.by`): "Total". */
  pointsHeader: string;
  /** The columns shown as parts of the score, in order; none leaves the parts out. */
  partHeaders: readonly string[];
  /** What the standings add up: "overall" for the overall table. */
  standingsScope: StandingsScope;
};

/** The tournament preset's parameters. */
export type BajaAppBracketParameters = BajaAppAddressParameters & {
  /** The tournament: "25SU_SPR". */
  resultadoId: string;
};

/**
 * The race (corrida.php) as a session and positions, the names joined from the event's
 * teams (equipes.php, fetched every 10 minutes). A clock state the preset does not know is
 * always refused. A simulated race is refused unless `acceptsSimulatedRace`, in which case
 * that one refusal (the positions') is taken off.
 *
 * What could go wrong: any refusal fails the whole poll, so the simulation refusal on the
 * positions also keeps a simulated session off air; an operator who deletes the positions
 * mapping in the flex form loses it with them.
 */
export function buildBajaAppRaceSourceConfig(parameters: BajaAppRaceParameters): HttpJsonConfig {
  const filledPreset = fillPresetPlaceholders(racePreset, {
    apiAddress: writeAddressWithoutTheLastSlash(parameters.apiAddress),
    eventId: parameters.eventId,
    provaId: parameters.provaId,
  });
  const config = HttpJsonConfigSchema.parse(filledPreset);
  if (!parameters.acceptsSimulatedRace) {
    return config;
  }
  const mappingsWithoutTheSimulationRefusal = config.mappings.map((mapping) => {
    if (mapping.refuseWhen?.message !== simulatedRaceRefusalMessage) {
      return mapping;
    }
    const mappingWithoutTheRefusal = { ...mapping };
    delete mappingWithoutTheRefusal.refuseWhen;
    return mappingWithoutTheRefusal;
  });
  return HttpJsonConfigSchema.parse({ ...config, mappings: mappingsWithoutTheSimulationRefusal });
}

/**
 * A results table (resultado.php) as standings: points from the column named, the parts
 * of the score from the headers picked, names joined from the teams, refused during
 * spoilers. Disqualified teams lose their rank in the mapping itself (BAJAOVRLAY-53).
 */
export function buildBajaAppResultsTableSourceConfig(
  parameters: BajaAppResultsTableParameters,
): HttpJsonConfig {
  const parameterValues: PresetParameterValues = {
    apiAddress: writeAddressWithoutTheLastSlash(parameters.apiAddress),
    eventId: parameters.eventId,
    resultadoId: parameters.resultadoId,
    pointsHeader: parameters.pointsHeader,
    standingsScope: parameters.standingsScope,
  };
  const config = HttpJsonConfigSchema.parse(
    fillPresetPlaceholders(resultsTablePreset, parameterValues),
  );
  const mappingsWithThePartsPicked = config.mappings.map((mapping) => {
    const { scorePartsFromColumns: proposedParts, ...mappingWithoutParts } = mapping;
    if (parameters.partHeaders.length === 0) {
      return mappingWithoutParts;
    }
    return {
      ...mappingWithoutParts,
      scorePartsFromColumns: { ...proposedParts, headers: [...parameters.partHeaders] },
    };
  });
  return HttpJsonConfigSchema.parse({ ...config, mappings: mappingsWithThePartsPicked });
}

/**
 * A tournament (torneio.php) as brackets: rounds holding matches, a round with a pending
 * or unknown side left out with the rounds after it, the third place moved before the
 * final. Names are joined from the teams (equipes.php, every 10 minutes), one lookup per
 * side, short else full, so an event without short names still maps (gate 2 of PR #38).
 */
export function buildBajaAppBracketSourceConfig(
  parameters: BajaAppBracketParameters,
): HttpJsonConfig {
  const filledPreset = fillPresetPlaceholders(tournamentPreset, {
    apiAddress: writeAddressWithoutTheLastSlash(parameters.apiAddress),
    eventId: parameters.eventId,
    resultadoId: parameters.resultadoId,
  });
  return HttpJsonConfigSchema.parse(filledPreset);
}

/**
 * The address of one endpoint of the API ("evento.php"), as the presets write theirs, for
 * a page that reads an answer before filling a preset in.
 */
export function buildBajaAppEndpointAddress(apiAddress: string, endpoint: string): string {
  return `${writeAddressWithoutTheLastSlash(apiAddress)}/resultados/${endpoint}`;
}

/** An address the operator typed, "https://api.bajasaebrasil.net/", without its last "/". */
function writeAddressWithoutTheLastSlash(address: string): string {
  return address.trim().replace(/\/+$/, '');
}

/** The refusal sentence a preset file writes on one shape's mapping, read once at load. */
function readRefusalMessageOfShape(
  preset: { mappings: Array<{ shapeKey: string; refuseWhen?: { message: string } }> },
  shapeKey: string,
): string {
  const mapping = preset.mappings.find((candidate) => candidate.shapeKey === shapeKey);
  const message = mapping?.refuseWhen?.message;
  if (message === undefined) {
    throw new Error(`a Baja app preset lost the refusal sentence of its ${shapeKey} mapping`);
  }
  return message;
}
