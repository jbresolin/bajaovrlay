/**
 * Mapping a flat list of matches into the brackets shape (packages/shared)
 *
 * What this module is for:
 *   The Baja app keeps an elimination in its `tournament` table, one row per match with a
 *   round code (2 the quarter-finals … 0 the final, -1 the third place), and BAJAOVRLAY-18
 *   will read it through a flex source. The mapping takes such a flat list, one rule per
 *   field of a match, and groups the matches into the shape's rounds by the round's name,
 *   in the order each round is first met (bracketRoundsOfMappedMatches.ts).
 *
 * What these tests prove:
 *   - A response in the shape of the endpoint asked of the Baja app (a match per element
 *     with its id as text, the round as a code, each slot a team or a bye) maps into brackets that pass
 *     validateDataShape: round codes made names and the third-place mark by mapValues,
 *     best of 3 with each car's wins, a bye with no carB at all.
 *   - A match whose round code the table cannot name fails the whole mapping, naming the
 *     match by its id and line; one with no round at all fails it too, as the grouping
 *     cannot place it.
 *
 * What these tests deliberately do not cover:
 *   - The general rules of a mapping (missing paths, problem lists, list order);
 *     applyFlexMapping.test.ts covers them with the positions.
 *   - Pending slots ("winN" in the Baja app until a match is decided): the shape has none,
 *     so the endpoint lists a match only once both its cars are known (BAJAOVRLAY-18).
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from '../dataShapes/validateDataShape.js';
import { applyFlexMapping } from './applyFlexMapping.js';
import { type FlexMappingConfig, FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The moment of the poll in these tests: 15:40 in Brasília on the Super Prime's day. */
const pollMomentMs = Date.UTC(2026, 9, 31, 18, 40, 0);

/** A slot holding a team, as the endpoint asked of the Baja app sends it. */
function buildTeamSlot(car: number, shortName: string, school: string, wins?: number) {
  return { kind: 'team', car, shortName, school, ...(wins === undefined ? {} : { wins }) };
}

/**
 * What the Baja app's tournament endpoint answers (the shape asked of it on BAJAOVRLAY-25's
 * review of the PHP code): the matches flat, a round code each, a bye as `{ kind: "bye" }`.
 */
function buildTournamentResponse(): { partidas: Array<Record<string, unknown>> } {
  return {
    partidas: [
      {
        id: 'J125',
        rodada: 1,
        melhorDe: 3,
        wo: false,
        slot1: buildTeamSlot(2, 'Baja UFMG', 'UFMG', 2),
        slot2: buildTeamSlot(17, 'Bombaja', 'UFSM', 0),
        vencedor: 2,
      },
      {
        id: 'J126',
        rodada: 1,
        melhorDe: 3,
        wo: false,
        slot1: buildTeamSlot(9, 'Caraubaja', 'UFERSA-Car', 0),
        slot2: buildTeamSlot(10, 'Komiketo', 'UFSJ', 2),
        vencedor: 10,
      },
      {
        id: 'J127',
        rodada: 0,
        melhorDe: 3,
        wo: false,
        slot1: buildTeamSlot(2, 'Baja UFMG', 'UFMG', 1),
        slot2: buildTeamSlot(10, 'Komiketo', 'UFSJ', 1),
        vencedor: null,
      },
      {
        id: 'J128',
        rodada: -1,
        melhorDe: 3,
        wo: true,
        slot1: buildTeamSlot(17, 'Bombaja', 'UFSM'),
        slot2: { kind: 'bye' },
        vencedor: 17,
      },
    ],
  };
}

/** The mapping written for that endpoint, checked as a saved config is checked. */
function buildTournamentMapping(): FlexMappingConfig {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'brackets',
      requestId: 'torneio',
      entriesPath: 'partidas',
      fields: [
        { targetField: 'sessionId', constantValue: 'super-prime-30a-competicao' },
        { targetField: 'updatedAtMs', fromPollMoment: true },
      ],
      entryFields: [
        {
          targetField: 'roundName',
          fromPath: 'rodada',
          transformId: 'mapValues',
          transformParameters: { '1': 'Semifinal', '0': 'Final', '-1': 'Disputa de 3º lugar' },
        },
        { targetField: 'matchId', fromPath: 'id' },
        {
          targetField: 'roundIsThirdPlace',
          fromPath: 'rodada',
          transformId: 'mapValues',
          transformParameters: { '1': false, '0': false, '-1': true },
        },
        { targetField: 'bestOf', fromPath: 'melhorDe' },
        { targetField: 'walkover', fromPath: 'wo' },
        { targetField: 'winnerCarNumber', fromPath: 'vencedor' },
        { targetField: 'carA.carNumber', fromPath: 'slot1.car' },
        { targetField: 'carA.teamName', fromPath: 'slot1.shortName' },
        { targetField: 'carA.schoolName', fromPath: 'slot1.school' },
        { targetField: 'carA.wins', fromPath: 'slot1.wins' },
        { targetField: 'carB.carNumber', fromPath: 'slot2.car' },
        { targetField: 'carB.teamName', fromPath: 'slot2.shortName' },
        { targetField: 'carB.schoolName', fromPath: 'slot2.school' },
        { targetField: 'carB.wins', fromPath: 'slot2.wins' },
      ],
    },
  ]);
}

describe('applyFlexMapping into brackets', () => {
  it('groups a flat list of matches into rounds that pass the brackets shape', () => {
    // Arrange: the tournament endpoint's response and the mapping written for it.
    const response = buildTournamentResponse();
    const mappings = buildTournamentMapping();

    // Act: map it, then validate the brackets exactly as the store does.
    const result = applyFlexMapping(mappings, { torneio: response }, pollMomentMs);
    const brackets = result.ok ? result.shapes.brackets : undefined;
    const validation = validateDataShape('brackets', brackets);

    // Assert: three rounds in the order met, the final still at 1 × 1 with no winner,
    // the third place marked, and the bye with no carB at all.
    expect(result.ok, 'the mapping must work').toBe(true);
    expect(validation.isValid, 'the mapped brackets must pass the brackets shape').toBe(true);
    expect(brackets, 'the matches must sit in their rounds as the endpoint gave them').toEqual({
      sessionId: 'super-prime-30a-competicao',
      updatedAtMs: pollMomentMs,
      rounds: [
        {
          name: 'Semifinal',
          matches: [
            {
              matchId: 'J125',
              bestOf: 3,
              walkover: false,
              winnerCarNumber: 2,
              carA: { carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG', wins: 2 },
              carB: { carNumber: 17, teamName: 'Bombaja', schoolName: 'UFSM', wins: 0 },
            },
            {
              matchId: 'J126',
              bestOf: 3,
              walkover: false,
              winnerCarNumber: 10,
              carA: { carNumber: 9, teamName: 'Caraubaja', schoolName: 'UFERSA-Car', wins: 0 },
              carB: { carNumber: 10, teamName: 'Komiketo', schoolName: 'UFSJ', wins: 2 },
            },
          ],
        },
        {
          name: 'Final',
          matches: [
            {
              matchId: 'J127',
              bestOf: 3,
              walkover: false,
              carA: { carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG', wins: 1 },
              carB: { carNumber: 10, teamName: 'Komiketo', schoolName: 'UFSJ', wins: 1 },
            },
          ],
        },
        {
          name: 'Disputa de 3º lugar',
          isThirdPlace: true,
          matches: [
            {
              matchId: 'J128',
              bestOf: 3,
              walkover: true,
              winnerCarNumber: 17,
              carA: { carNumber: 17, teamName: 'Bombaja', schoolName: 'UFSM' },
            },
          ],
        },
      ],
    });
  });

  it('fails the whole mapping on a round code the table cannot name, naming the match', () => {
    // Arrange: the response with the final sent as round 7, a code nobody put in the table.
    const response = buildTournamentResponse();
    const finalMatch = response.partidas[2];
    if (finalMatch !== undefined) {
      finalMatch.rodada = 7;
    }
    const mappings = buildTournamentMapping();

    // Act: map it.
    const result = applyFlexMapping(mappings, { torneio: response }, pollMomentMs);

    // Assert: a failure whose first problem names the brackets, the final on line 3 and
    // the round; a guessed round would draw the final in the wrong column.
    expect(result.ok, 'an unknown round code must fail the mapping').toBe(false);
    const problems = result.ok ? [] : result.problems;
    expect(problems[0], 'the problem must name the shape, the match and the field').toMatch(
      /^Chaves › disputa J127 \(linha 3\) › Fase: /,
    );
  });

  it('fails the whole mapping on a match that names no round, since it cannot be placed', () => {
    // Arrange: the response with the final's round left empty (null) by the source.
    const response = buildTournamentResponse();
    const finalMatch = response.partidas[2];
    if (finalMatch !== undefined) {
      finalMatch.rodada = null;
    }
    const mappings = buildTournamentMapping();

    // Act: map it.
    const result = applyFlexMapping(mappings, { torneio: response }, pollMomentMs);

    // Assert: one problem, at the final's round name, saying why it matters.
    expect(result.ok, 'a match with no round must fail the mapping').toBe(false);
    expect(result.ok ? [] : result.problems, 'the problem must say the round is missing').toEqual([
      'Chaves › disputa J127 (linha 3) › Fase: falta o nome da fase, que diz em que fase a disputa entra',
    ]);
  });
});
