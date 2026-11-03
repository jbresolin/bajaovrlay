// Test support: the Baja app presets filled in on the events of the real fixtures, and
// one step that maps answers with a preset and validates every shape, as the store does
// with a poll. Every builder returns a new config; nothing is shared between tests.
import type { DataShapeKey } from '../../../dataShapes/dataShapeKey.js';
import { validateDataShape } from '../../../dataShapes/validateDataShape.js';
import type { HttpJsonConfig } from '../../../dataSources/httpJsonConfig.js';
import { applyFlexMapping } from '../../applyFlexMapping.js';
import {
  bajaAppApiAddress,
  buildBajaAppBracketSourceConfig,
  buildBajaAppRaceSourceConfig,
  buildBajaAppResultsTableSourceConfig,
  proposedScorePartHeaders,
} from './bajaAppPresets.js';

/** The moment of the poll in these tests: when the doc's race was ten minutes in. */
export const pollMomentMs = 1_760_000_600_000;

/** The race preset on 26BR's Enduro, a simulated race refused as the preset ships. */
export function buildRaceConfigOf26BREnduro(acceptsSimulatedRace = false): HttpJsonConfig {
  return buildBajaAppRaceSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '26BR',
    provaId: 'END',
    acceptsSimulatedRace,
  });
}

/** The results table preset on 26BR's overall table, its points in "Total". */
export function buildOverallConfigOf26BR(
  partHeaders: readonly string[] = proposedScorePartHeaders,
) {
  return buildBajaAppResultsTableSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '26BR',
    resultadoId: '26BR_GER',
    pointsHeader: 'Total',
    partHeaders,
    standingsScope: 'overall',
  });
}

/** The tournament preset on 25SU's Super Prime. */
export function buildBracketConfigOf25SU(): HttpJsonConfig {
  return buildBajaAppBracketSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '25SU',
    resultadoId: '25SU_SPR',
  });
}

/**
 * Maps the answers with a preset's mappings and validates every shape the mapping gave:
 * the valid shapes by key, or the problems (a refusal, a mapping problem or a validation
 * one).
 */
export function mapAndValidate(config: HttpJsonConfig, responses: Record<string, unknown>) {
  const result = applyFlexMapping(config.mappings, responses, pollMomentMs);
  if (!result.ok) {
    return { problems: result.problems, shapes: undefined };
  }
  const shapes: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [shapeKey, mappedShape] of Object.entries(result.shapes)) {
    const validation = validateDataShape(shapeKey as DataShapeKey, mappedShape);
    if (validation.isValid) {
      shapes[shapeKey] = validation.shape;
    } else {
      problems.push(validation.errorMessage);
    }
  }
  return { problems, shapes };
}
