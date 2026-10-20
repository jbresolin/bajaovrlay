/**
 * Finding the correction of a value without searching for it in every cell (apps/control)
 *
 * What this module is for:
 *   The Fontes tables redraw 60 cars at every poll. Gate 2 of PR #18 found each correctable
 *   cell subscribing to the store and searching the overrides for itself, about 360 times
 *   per poll, which froze the page. buildOverrideLookup builds one Map per redraw, keyed by
 *   source, scope, field and car, and each cell is handed its correction from it.
 *
 * What these tests prove:
 *   - A car's correction and a session correction are found by their own keys.
 *   - The same field of another car, or of another source, finds nothing.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the cells; DataSourcesPageCorrections.test.tsx.
 */
import type { Override } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildOverrideLookup, findOverrideInLookup } from './overrideLookup';

const car42TeamCorrection: Override = {
  sourceId: 'simulador-enduro',
  scope: 'car',
  carNumber: 42,
  field: 'teamName',
  value: 'Jequitibá Racing Team',
  reason: 'Nome oficial da inscrição.',
  setBy: 'operador:3f2a9c1e',
  setAt: '2027-03-20T19:25:00.000Z',
};

const sessionNameCorrection: Override = {
  sourceId: 'simulador-enduro',
  scope: 'session',
  field: 'sessionName',
  value: 'Enduro — Etapa Nacional',
  reason: 'Nome oficial da prova.',
  setBy: 'operador:3f2a9c1e',
  setAt: '2027-03-20T19:25:00.000Z',
};

describe('buildOverrideLookup', () => {
  const lookupScenarios = [
    // Car 42's team: its own correction.
    {
      name: "finds car 42's team correction",
      key: {
        sourceId: 'simulador-enduro',
        scope: 'car' as const,
        carNumber: 42,
        field: 'teamName',
      },
      expected: car42TeamCorrection,
    },
    // The session name: a session correction has no car.
    {
      name: 'finds the session name correction',
      key: { sourceId: 'simulador-enduro', scope: 'session' as const, field: 'sessionName' },
      expected: sessionNameCorrection,
    },
    // Car 31's team was not corrected.
    {
      name: "finds nothing for car 31's team",
      key: {
        sourceId: 'simulador-enduro',
        scope: 'car' as const,
        carNumber: 31,
        field: 'teamName',
      },
      expected: undefined,
    },
    // The same key in another source is another correction.
    {
      name: 'finds nothing for car 42 of another source',
      key: { sourceId: 'cronometragem', scope: 'car' as const, carNumber: 42, field: 'teamName' },
      expected: undefined,
    },
  ];

  it.each(lookupScenarios)('$name', ({ key, expected }) => {
    // Arrange: one lookup of the two corrections in force.
    const lookup = buildOverrideLookup([car42TeamCorrection, sessionNameCorrection]);

    // Act: find this row's key.
    const found = findOverrideInLookup(lookup, key);

    // Assert: the correction of that key, or none.
    expect(found, 'the lookup must answer this key').toBe(expected);
  });
});
