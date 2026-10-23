/**
 * The paths a binding may point at (packages/shared)
 *
 * What this module is for:
 *   An item field can take its value from a data source ("the team name of the car in
 *   1st place", BAJAOVRLAY-20). The item editor's picker offers the list
 *   `listBindablePathsOfShape` returns: a path inside one shape, the pt-BR label the
 *   operator reads ("Posições › 1º colocado › Equipe"), the type of value found there
 *   (so the picker offers a text path to a text field only), and whether the path picks
 *   its car by number instead of by place. The list is written by hand, on purpose.
 *
 * What these tests prove:
 *   - The session list is fixed, label by label and type by type, with the whole clock
 *     ("Relógio completo", the clock group) before its four fields.
 *   - Positions offer the whole list, then one car chosen by its number, then the 1st to
 *     10th places, each with the same twelve fields and the same types.
 *   - Standings offer the scope, the whole list and the 1st to 10th rows, labelled
 *     "1ª linha", not "1º colocado": tied teams share a rank. Brackets (a draft) offer
 *     only their rounds.
 *   - No path appears twice within a shape.
 *   - findBindablePath reads one entry back, and answers undefined for a path not listed.
 *
 * What these tests deliberately do not cover:
 *   - Reading a path out of a real snapshot; bindingResolution.test.ts does that.
 *   - Which graphic field a type fits; bindingFitsGraphicField.test.ts does that.
 *   - That every path names a real field of its shape; bindablePathsMatchShapes.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { findBindablePath, listBindablePathsOfShape } from './bindablePaths.js';
import type { DataShapeKey } from './dataShapeKey.js';

describe('listBindablePathsOfShape', () => {
  it('lists the session fields a graphic can show, with their pt-BR labels and types', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the session's paths.
    const sessionPaths = listBindablePathsOfShape('session');

    // Assert: exactly these, in this order. The whole clock comes before its fields,
    // because a race clock must take its four clock fields together or it jumps.
    expect(sessionPaths, 'the session paths must be this fixed list').toEqual([
      {
        path: 'eventName',
        label: 'Sessão › Evento',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'sessionName',
        label: 'Sessão › Nome da sessão',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'sessionKind',
        label: 'Sessão › Prova',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'state',
        label: 'Sessão › Bandeira',
        valueType: 'stateEnum',
        isCarChosenByNumber: false,
      },
      {
        path: 'clock',
        label: 'Sessão › Relógio completo',
        valueType: 'clockGroup',
        isCarChosenByNumber: false,
      },
      {
        path: 'clock.clockMode',
        label: 'Sessão › Relógio › Modo',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'clock.referenceTimeMs',
        label: 'Sessão › Relógio › Tempo de referência',
        valueType: 'integer',
        isCarChosenByNumber: false,
      },
      {
        path: 'clock.referenceWallClockMs',
        label: 'Sessão › Relógio › Horário da referência',
        valueType: 'integer',
        isCarChosenByNumber: false,
      },
      {
        path: 'clock.running',
        label: 'Sessão › Relógio › Correndo',
        valueType: 'boolean',
        isCarChosenByNumber: false,
      },
      {
        path: 'scheduledDurationMs',
        label: 'Sessão › Duração prevista',
        valueType: 'integer',
        isCarChosenByNumber: false,
      },
      {
        path: 'lapsCompletedByLeader',
        label: 'Sessão › Voltas do líder',
        valueType: 'integer',
        isCarChosenByNumber: false,
      },
    ]);
  });

  it('lists the whole positions list, then one car chosen by its number, field by field', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the positions paths and keep the first thirteen.
    const positionsPaths = listBindablePathsOfShape('positions');
    const wholeListAndCarChosenByNumber = positionsPaths.slice(0, 13);

    // Assert: the whole list first (the tower), then the twelve fields of the car whose
    // number the binding names (a team card that follows car 42 wherever it runs).
    expect(
      wholeListAndCarChosenByNumber,
      'the whole list and the car chosen by number must be this fixed list',
    ).toEqual([
      {
        path: 'entries',
        label: 'Posições › Lista completa',
        valueType: 'positionsEntries',
        isCarChosenByNumber: false,
      },
      {
        path: 'entryOfCar.carNumber',
        label: 'Posições › Carro escolhido pelo número › Carro',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.teamName',
        label: 'Posições › Carro escolhido pelo número › Equipe',
        valueType: 'text',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.schoolName',
        label: 'Posições › Carro escolhido pelo número › Escola',
        valueType: 'text',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.laps',
        label: 'Posições › Carro escolhido pelo número › Voltas',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.lastLapMs',
        label: 'Posições › Carro escolhido pelo número › Última volta',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.bestLapMs',
        label: 'Posições › Carro escolhido pelo número › Melhor volta',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.gapToLeaderMs',
        label: 'Posições › Carro escolhido pelo número › Diferença para o líder (tempo)',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.gapToLeaderLaps',
        label: 'Posições › Carro escolhido pelo número › Diferença para o líder (voltas)',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.intervalMs',
        label: 'Posições › Carro escolhido pelo número › Intervalo para o carro à frente',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.pitStops',
        label: 'Posições › Carro escolhido pelo número › Paradas nos boxes',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.fuelStops',
        label: 'Posições › Carro escolhido pelo número › Abastecimentos',
        valueType: 'integer',
        isCarChosenByNumber: true,
      },
      {
        path: 'entryOfCar.status',
        label: 'Posições › Carro escolhido pelo número › Situação',
        valueType: 'text',
        isCarChosenByNumber: true,
      },
    ]);
  });

  it('lists the 1st place with the same fields and types as the car chosen by number', () => {
    // Arrange: the twelve fields of the car chosen by number, the test above checks them.
    const positionsPaths = listBindablePathsOfShape('positions');
    const carChosenByNumberFields = positionsPaths.slice(1, 13);

    // Act: keep the twelve paths of the 1st place, which follow the car chosen by number.
    const firstPlaceFields = positionsPaths.slice(13, 25);

    // Assert: same fields in the same order with the same types, only labelled by place.
    expect(
      firstPlaceFields.map((bindablePath) => [bindablePath.path, bindablePath.valueType]),
      'the 1st place must offer the same fields and types',
    ).toEqual(
      carChosenByNumberFields.map((bindablePath) => [
        bindablePath.path.replace('entryOfCar.', 'entries.0.'),
        bindablePath.valueType,
      ]),
    );
    expect(firstPlaceFields[1], 'a place path is labelled by its place').toEqual({
      path: 'entries.0.teamName',
      label: 'Posições › 1º colocado › Equipe',
      valueType: 'text',
      isCarChosenByNumber: false,
    });
    expect(firstPlaceFields[10], 'the refuels of a place are offered as a whole number').toEqual({
      path: 'entries.0.fuelStops',
      label: 'Posições › 1º colocado › Abastecimentos',
      valueType: 'integer',
      isCarChosenByNumber: false,
    });
  });

  it('stops the positions at the 10th place, with twelve fields per place', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the positions paths.
    const positionsPaths = listBindablePathsOfShape('positions');

    // Assert: the whole list, the car by number and 10 places, all of 12 fields.
    expect(positionsPaths, 'positions must offer 1 + 12 + 10 × 12 paths').toHaveLength(133);
    expect(positionsPaths.at(-1), 'the last path must be the 10th place status').toEqual({
      path: 'entries.9.status',
      label: 'Posições › 10º colocado › Situação',
      valueType: 'text',
      isCarChosenByNumber: false,
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
      {
        path: 'scope',
        label: 'Pontuação › Abrangência',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries',
        label: 'Pontuação › Lista completa',
        valueType: 'standingsEntries',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries.0.carNumber',
        label: 'Pontuação › 1ª linha › Carro',
        valueType: 'integer',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries.0.teamName',
        label: 'Pontuação › 1ª linha › Equipe',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries.0.schoolName',
        label: 'Pontuação › 1ª linha › Escola',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries.0.points',
        label: 'Pontuação › 1ª linha › Pontos',
        valueType: 'number',
        isCarChosenByNumber: false,
      },
    ]);
    expect(standingsPaths, 'standings must offer 2 + 10 × 4 paths').toHaveLength(42);
    expect(standingsPaths.at(-1), 'the last path must be the 10th row points').toEqual({
      path: 'entries.9.points',
      label: 'Pontuação › 10ª linha › Pontos',
      valueType: 'number',
      isCarChosenByNumber: false,
    });
  });

  it('offers only the rounds of the draft brackets shape', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the brackets paths.
    const bracketsPaths = listBindablePathsOfShape('brackets');

    // Assert: one path, until BAJAOVRLAY-25 settles the shape.
    expect(bracketsPaths, 'brackets must offer only the rounds').toEqual([
      {
        path: 'rounds',
        label: 'Chaves › Todas as fases',
        valueType: 'bracketsRounds',
        isCarChosenByNumber: false,
      },
    ]);
  });

  const everyShapeScenarios: Array<{ name: string; shapeKey: DataShapeKey }> = [
    // The clock group and the clock's own fields must not repeat a top-level field.
    { name: 'the session', shapeKey: 'session' },
    // The car chosen by number and the loop over places must not emit any path twice.
    { name: 'the positions', shapeKey: 'positions' },
    // The scope and the whole list sit before the rows and must not be repeated by them.
    { name: 'the standings', shapeKey: 'standings' },
    // The draft has a single path; this row keeps it honest when BAJAOVRLAY-25 adds more.
    { name: 'the brackets', shapeKey: 'brackets' },
  ];

  it.each(everyShapeScenarios)('never lists a path of $name twice', ({ shapeKey }) => {
    // Arrange: the paths of this row's shape.
    const paths = listBindablePathsOfShape(shapeKey).map((bindablePath) => bindablePath.path);

    // Act: drop the repeats.
    const distinctPaths = new Set(paths);

    // Assert: nothing was dropped.
    expect(distinctPaths.size, 'every path must appear once').toBe(paths.length);
  });
});

describe('findBindablePath', () => {
  it('finds the leader team name of the positions by its path', () => {
    // Arrange: the path a team card of the leader stores.
    const path = 'entries.0.teamName';

    // Act: read the entry back.
    const bindablePath = findBindablePath('positions', path);

    // Assert: the listed entry, with its label and type.
    expect(bindablePath, 'the listed entry must be found').toEqual({
      path: 'entries.0.teamName',
      label: 'Posições › 1º colocado › Equipe',
      valueType: 'text',
      isCarChosenByNumber: false,
    });
  });

  it('answers undefined for the 11th place, which is not listed', () => {
    // Arrange: a path past the ten places that get paths of their own.
    const path = 'entries.10.teamName';

    // Act: look it up.
    const bindablePath = findBindablePath('positions', path);

    // Assert: nothing; a graphic that needs more places takes the whole list.
    expect(bindablePath, 'a path that is not listed must not be found').toBeUndefined();
  });
});
