// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/bracket)
 *
 * What this module is for:
 *   bracket.ograf.json describes the data as JSON Schema, for renderers, the server's check
 *   of a take and the control page's form; bracketModel.ts checks the same data with Zod in
 *   `load` and `updateAction`. If they disagreed, the server could put on air data the
 *   graphic refuses, or refuse data it would draw.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the real Super Prime with its title; the
 *     rounds alone; the six result states; brackets with no round; a match carrying fields
 *     the bracket does not draw (passes); and refused: no rounds, a round without matches,
 *     a match without carA, a car without its team, a car number of 0, wins written as
 *     text, a top-level field the bracket does not know.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest: bracketManifest.test.ts.
 *   - The shape's own rules (a bye's winner, the wins of a best of N): the source's data
 *     passes the shared brackets shape first; the graphic repeats none of them.
 *   - The page: this file runs in plain Node (line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import bracketManifest from '../bracket.ograf.json';
import { type BracketData, parseCompleteBracketData } from './bracketModel.js';
import { createResultStatesOnABoard, createTheRealSuperPrime } from './previewData.js';

/** The results board with its first match changed by `change`. */
function createResultsWithTheFirstMatchChanged(
  change: (match: Record<string, unknown>) => Record<string, unknown>,
): unknown {
  const results: BracketData = createResultStatesOnABoard();
  return {
    rounds: results.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match, index) => (index === 0 ? change({ ...match }) : match)),
    })),
  };
}

const dataAgreementScenarios = [
  // The everyday payload: the source's whole rounds and a typed title.
  {
    name: 'both accept the real Super Prime with its title',
    data: createTheRealSuperPrime(),
    isValid: true,
  },
  // An item that binds the rounds and types nothing else.
  {
    name: 'both accept the rounds alone',
    data: { rounds: createTheRealSuperPrime().rounds },
    isValid: true,
  },
  // Times, wins, a plain win, W.O.s, a bye and an undecided match.
  { name: 'both accept the six result states', data: createResultStatesOnABoard(), isValid: true },
  // A source with nothing listed yet: the head alone.
  { name: 'both accept brackets with no round', data: { rounds: [] }, isValid: true },
  // A source's extra fields ride along.
  {
    name: 'both accept a match with a field the bracket does not draw',
    data: createResultsWithTheFirstMatchChanged((match) => ({ ...match, pista: 'Pista 2' })),
    isValid: true,
  },
  // The one required field left out.
  { name: 'both refuse data without rounds', data: { title: 'SUPER PRIME' }, isValid: false },
  // A round must list its matches, even none.
  {
    name: 'both refuse a round without its matches',
    data: { rounds: [{ name: 'Final' }] },
    isValid: false,
  },
  // Every match has at least carA.
  {
    name: 'both refuse a match without carA',
    data: createResultsWithTheFirstMatchChanged((match) => ({ matchId: match.matchId })),
    isValid: false,
  },
  // A car without its team cannot be drawn.
  {
    name: 'both refuse a car without its team',
    data: createResultsWithTheFirstMatchChanged((match) => ({
      ...match,
      carA: { carNumber: 32, schoolName: 'UPE' },
    })),
    isValid: false,
  },
  // Car numbers start at 1.
  {
    name: 'both refuse a car number of 0',
    data: createResultsWithTheFirstMatchChanged((match) => ({
      ...match,
      carA: { carNumber: 0, teamName: 'Corisco', schoolName: 'UPE' },
    })),
    isValid: false,
  },
  // Wins are a count, not a word.
  {
    name: 'both refuse wins written as text',
    data: createResultsWithTheFirstMatchChanged((match) => ({
      ...match,
      bestOf: 3,
      carA: { carNumber: 32, teamName: 'Corisco', schoolName: 'UPE', wins: 'dois' },
    })),
    isValid: false,
  },
  // A typo'd top-level field must fail both.
  {
    name: 'both refuse a top-level field the bracket does not know',
    data: { rounds: [], titulo: 'SUPER PRIME' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled; JSON drops undefined fields, as the
    // wire does.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(bracketManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteBracketData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
