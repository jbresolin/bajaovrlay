/**
 * The paths a binding may point at (packages/shared)
 *
 * What this module is for:
 *   BAJAOVRLAY-20 lets an item field take its value from a data source ("the team name of
 *   the car in 1st place"). Its picker offers the list `listBindablePathsOfShape` returns:
 *   a path inside one shape and a pt-BR label the operator reads, such as
 *   "Posições › 1º colocado › Equipe". The list is written by hand, on purpose.
 *
 * What these tests prove:
 *   - The session list is fixed, label by label.
 *   - Positions offer the whole list plus the 1st to 10th places, each with the same
 *     eleven fields; the 1st place is fixed label by label, the 10th checked as the last.
 *   - Standings offer the scope, the whole list plus the 1st to 10th rows with four
 *     fields each, labelled "1ª linha", not "1º colocado": tied teams share a rank, so
 *     the row's index is not its place; brackets (a draft) offer only their rounds.
 *   - No path appears twice within a shape.
 *
 * What these tests deliberately do not cover:
 *   - Resolving a path against a payload; that is BAJAOVRLAY-20.
 */
import { describe, expect, it } from 'vitest';

import { listBindablePathsOfShape } from './bindablePaths.js';
import type { DataShapeKey } from './dataShapeKey.js';

describe('listBindablePathsOfShape', () => {
  it('lists the session fields a graphic can show, with their pt-BR labels', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the session's paths.
    const sessionPaths = listBindablePathsOfShape('session');

    // Assert: exactly these, in this order.
    expect(sessionPaths, 'the session paths must be this fixed list').toEqual([
      { path: 'eventName', label: 'Sessão › Evento' },
      { path: 'sessionName', label: 'Sessão › Nome da sessão' },
      { path: 'sessionKind', label: 'Sessão › Prova' },
      { path: 'state', label: 'Sessão › Bandeira' },
      { path: 'clock.clockMode', label: 'Sessão › Relógio › Modo' },
      { path: 'clock.referenceTimeMs', label: 'Sessão › Relógio › Tempo de referência' },
      {
        path: 'clock.referenceWallClockMs',
        label: 'Sessão › Relógio › Horário da referência',
      },
      { path: 'clock.running', label: 'Sessão › Relógio › Correndo' },
      { path: 'scheduledDurationMs', label: 'Sessão › Duração prevista' },
      { path: 'lapsCompletedByLeader', label: 'Sessão › Voltas do líder' },
    ]);
  });

  it('lists the whole positions list and then the 1st place field by field', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the positions paths and keep the first twelve.
    const positionsPaths = listBindablePathsOfShape('positions');
    const wholeListAndFirstPlace = positionsPaths.slice(0, 12);

    // Assert: the whole list first, then the leader's eleven fields.
    expect(wholeListAndFirstPlace, 'the leader paths must be this fixed list').toEqual([
      { path: 'entries', label: 'Posições › Lista completa' },
      { path: 'entries.0.carNumber', label: 'Posições › 1º colocado › Carro' },
      { path: 'entries.0.teamName', label: 'Posições › 1º colocado › Equipe' },
      { path: 'entries.0.schoolName', label: 'Posições › 1º colocado › Escola' },
      { path: 'entries.0.laps', label: 'Posições › 1º colocado › Voltas' },
      { path: 'entries.0.lastLapMs', label: 'Posições › 1º colocado › Última volta' },
      { path: 'entries.0.bestLapMs', label: 'Posições › 1º colocado › Melhor volta' },
      {
        path: 'entries.0.gapToLeaderMs',
        label: 'Posições › 1º colocado › Diferença para o líder (tempo)',
      },
      {
        path: 'entries.0.gapToLeaderLaps',
        label: 'Posições › 1º colocado › Diferença para o líder (voltas)',
      },
      {
        path: 'entries.0.intervalMs',
        label: 'Posições › 1º colocado › Intervalo para o carro à frente',
      },
      { path: 'entries.0.pitStops', label: 'Posições › 1º colocado › Paradas nos boxes' },
      { path: 'entries.0.status', label: 'Posições › 1º colocado › Situação' },
    ]);
  });

  it('stops the positions at the 10th place, with eleven fields per place', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the positions paths.
    const positionsPaths = listBindablePathsOfShape('positions');

    // Assert: the whole list plus 10 places of 11 fields, ending with the 10th place.
    expect(positionsPaths, 'positions must offer 1 + 10 × 11 paths').toHaveLength(111);
    expect(positionsPaths.at(-1), 'the last path must be the 10th place status').toEqual({
      path: 'entries.9.status',
      label: 'Posições › 10º colocado › Situação',
    });
  });

  it('lists the standings scope, the whole list and the first ten rows, named as rows', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the standings paths.
    const standingsPaths = listBindablePathsOfShape('standings');

    // Assert: scope and list first, then the first row's four fields, 2 + 10 × 4 in all.
    // A row, not a place: two teams tied on points share a rank, so the 2nd row may be
    // a 1st place (gate 2 on PR #16).
    expect(standingsPaths.slice(0, 6), 'the standings leader paths must be fixed').toEqual([
      { path: 'scope', label: 'Pontuação › Abrangência' },
      { path: 'entries', label: 'Pontuação › Lista completa' },
      { path: 'entries.0.carNumber', label: 'Pontuação › 1ª linha › Carro' },
      { path: 'entries.0.teamName', label: 'Pontuação › 1ª linha › Equipe' },
      { path: 'entries.0.schoolName', label: 'Pontuação › 1ª linha › Escola' },
      { path: 'entries.0.points', label: 'Pontuação › 1ª linha › Pontos' },
    ]);
    expect(standingsPaths, 'standings must offer 2 + 10 × 4 paths').toHaveLength(42);
    expect(standingsPaths.at(-1), 'the last path must be the 10th row points').toEqual({
      path: 'entries.9.points',
      label: 'Pontuação › 10ª linha › Pontos',
    });
  });

  it('offers only the rounds of the draft brackets shape', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the brackets paths.
    const bracketsPaths = listBindablePathsOfShape('brackets');

    // Assert: one path, until BAJAOVRLAY-25 settles the shape.
    expect(bracketsPaths, 'brackets must offer only the rounds').toEqual([
      { path: 'rounds', label: 'Chaves › Todas as fases' },
    ]);
  });

  const noRepeatedPathScenarios: Array<{ name: string; shapeKey: DataShapeKey }> = [
    // The clock's own fields must not repeat a top-level session field.
    { name: 'no session path appears twice', shapeKey: 'session' },
    // The loop over places must not emit any place twice.
    { name: 'no positions path appears twice', shapeKey: 'positions' },
    // The scope and the whole list sit before the places and must not be repeated by them.
    { name: 'no standings path appears twice', shapeKey: 'standings' },
    // The draft has a single path; this row keeps it honest when BAJAOVRLAY-25 adds more.
    { name: 'no brackets path appears twice', shapeKey: 'brackets' },
  ];

  it.each(noRepeatedPathScenarios)('$name', ({ shapeKey }) => {
    // Arrange: the paths of this row's shape.
    const paths = listBindablePathsOfShape(shapeKey).map((bindablePath) => bindablePath.path);

    // Act: drop the repeats.
    const distinctPaths = new Set(paths);

    // Assert: nothing was dropped.
    expect(distinctPaths.size, 'every path must appear once').toBe(paths.length);
  });
});
