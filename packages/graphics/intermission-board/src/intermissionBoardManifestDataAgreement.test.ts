// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/intermission-board)
 *
 * What this module is for:
 *   intermission-board.ograf.json describes the data as JSON Schema; intermissionBoardModel.ts
 *   checks the same data with Zod. If they disagreed, the server's check and the graphic's
 *   could answer differently for one take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both: the four combinations of the optional parts; a
 *     standings entry carrying its points by part (as the binding sends it); and a start as
 *     text, no next session, a team with no points, a sponsor of a level nobody sells and
 *     an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; intermissionBoardManifest.test.ts.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import intermissionBoardManifest from '../intermission-board.ograf.json';
import { parseCompleteIntermissionBoardData } from './intermissionBoardModel.js';
import {
  createBreakBeforeTheEnduro,
  createEightSponsors,
} from './intermissionBoardOnThePage.testSupport.js';

/** The full break with its first team changed. */
function withTheLeaderChanged(change: Record<string, unknown>): unknown {
  const data = createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: false });
  const [leader, ...others] = data.topFive ?? [];
  return { ...data, topFive: [{ ...leader, ...change }, ...others] };
}

const dataAgreementScenarios = [
  // The four combinations of the design's motion demos.
  {
    name: 'both accept the full break',
    data: createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: true }),
    isValid: true,
  },
  {
    name: 'both accept it without sponsors',
    data: createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: false }),
    isValid: true,
  },
  {
    name: 'both accept it without the top five',
    data: createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: true }),
    isValid: true,
  },
  {
    name: 'both accept the next session alone',
    data: createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: false }),
    isValid: true,
  },
  // The binding sends the whole standings entry, its points by part too.
  {
    name: 'both accept a standings entry with its points by part',
    data: withTheLeaderChanged({ pointsByPart: { projeto: 246.81, enduro: 312.5 } }),
    isValid: true,
  },
  // The start is milliseconds.
  {
    name: 'both refuse a start as text',
    data: {
      ...createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: false }),
      nextStartsAtMs: '10:00',
    },
    isValid: false,
  },
  // A break must say what comes next.
  {
    name: 'both refuse no next session',
    data: { nextStartsAtMs: 1_743_339_600_000 },
    isValid: false,
  },
  // A team needs its points.
  {
    name: 'both refuse a team with no points',
    data: withTheLeaderChanged({ points: undefined }),
    isValid: false,
  },
  // Six levels only.
  {
    name: 'both refuse a sponsor of a level nobody sells',
    data: {
      ...createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: false }),
      sponsors: [{ ...createEightSponsors()[0], level: 'platina' }],
    },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: {
      ...createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: false }),
      title: 'INTERVALO',
    },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled; the payload as JSON sends it.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(intermissionBoardManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteIntermissionBoardData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
