/**
 * Paths into a JSON response (packages/shared)
 *
 * What this module is for:
 *   A flex source's mapping says where each value sits in the response with a path:
 *   dot-separated keys and numeric indices, `dados.corrida.carros[3].equipe`. There are no
 *   wildcards, filters, recursion or functions, so a reviewer can read a path at a glance.
 *   `parseValuePath` checks a path when a config is saved; `readValueAtPath` reads it.
 *
 * What these tests prove:
 *   - Reading: a nested key, an index, a key after an index, and the top-level key all
 *     give their value; a null is handed back as found (the mapping decides it means
 *     "the source does not know"); an index out of range, a missing key, a key on a list
 *     and an index on an object find nothing there.
 *   - Refusing: an empty path, an empty segment, an unclosed or stray bracket, an empty,
 *     negative or non-numeric index, an index without a key and text after an index are
 *     each refused with their own pt-BR sentence quoting the path.
 *
 * What these tests deliberately do not cover:
 *   - A key with a dot or a bracket in it, which is out of scope (see the README).
 *   - What the mapping does with a value it found; applyFlexMapping.test.ts covers that.
 */
import { describe, expect, it } from 'vitest';

import { parseValuePath, readValueAtPath, type ValueAtPath } from './valuePath.js';

/** A small response from a timing system, the shape the paths below walk through. */
function buildTimingSystemResponse() {
  return {
    dados: {
      corrida: {
        nome: 'Enduro de Resistência',
        carros: [
          { carro: '31', equipe: 'Acauã Baja', tempos: { ultima: '4:38.293' } },
          { carro: '38', equipe: 'Coruja Racing', tempos: { ultima: '4:43.550' } },
          { carro: '25', equipe: 'Bem-te-vi Off-Road', tempos: { ultima: null } },
        ],
      },
    },
    bandeira: 'VERDE',
    grade: [
      ['31', '38'],
      ['25', '12'],
    ],
  };
}

describe('readValueAtPath', () => {
  const pathReadingScenarios: Array<{ name: string; path: string; expected: ValueAtPath }> = [
    // The simplest path: one key at the top of the response.
    {
      name: 'reads the flag at the top of the response',
      path: 'bandeira',
      expected: { outcome: 'found', value: 'VERDE' },
    },
    // Keys inside keys, the usual way a response nests its data.
    {
      name: 'reads the session name two objects down',
      path: 'dados.corrida.nome',
      expected: { outcome: 'found', value: 'Enduro de Resistência' },
    },
    // An index picks one element of a list, counting from 0.
    {
      name: 'reads the team of the second car in the list',
      path: 'dados.corrida.carros[1].equipe',
      expected: { outcome: 'found', value: 'Coruja Racing' },
    },
    // Two indices in a row walk a list of lists.
    {
      name: 'reads a car number from a list of lists',
      path: 'grade[1][0]',
      expected: { outcome: 'found', value: '25' },
    },
    // A path may stop on a whole list: that is how the mapping finds the cars.
    {
      name: 'reads the whole list of cars',
      path: 'dados.corrida.carros',
      expected: { outcome: 'found', value: buildTimingSystemResponse().dados.corrida.carros },
    },
    // null is a value the source sent; the mapping, not the path, decides it means unknown.
    {
      name: 'hands back a null last lap as found',
      path: 'dados.corrida.carros[2].tempos.ultima',
      expected: { outcome: 'found', value: null },
    },
    // Only three cars: a fourth is not there, and that is not an error of the path.
    {
      name: 'finds nothing at an index past the end of the list',
      path: 'dados.corrida.carros[3].equipe',
      expected: { outcome: 'nothingThere' },
    },
    // A key the response does not have is nothing there, so an optional field is left out.
    {
      name: 'finds nothing at a key the response does not have',
      path: 'dados.corrida.carros[0].escola',
      expected: { outcome: 'nothingThere' },
    },
    // A key on a list is not read as an index or as "length": lists take [n] only.
    {
      name: 'finds nothing when a key is asked of a list',
      path: 'dados.corrida.carros.length',
      expected: { outcome: 'nothingThere' },
    },
    // An index on an object is not read as a key "0".
    {
      name: 'finds nothing when an index is asked of an object',
      path: 'dados[0]',
      expected: { outcome: 'nothingThere' },
    },
    // Walking past a text value finds nothing, rather than reading a letter of it.
    {
      name: 'finds nothing below a text value',
      path: 'bandeira.cor',
      expected: { outcome: 'nothingThere' },
    },
    // Walking past a null finds nothing too, rather than failing.
    {
      name: 'finds nothing below a null',
      path: 'dados.corrida.carros[2].tempos.ultima.minutos',
      expected: { outcome: 'nothingThere' },
    },
    // A key the object only inherits must not be found.
    {
      name: 'finds nothing at a key every object inherits',
      path: 'dados.constructor',
      expected: { outcome: 'nothingThere' },
    },
  ];

  it.each(pathReadingScenarios)('$name', ({ path, expected }) => {
    // Arrange: a response with a session, three cars, a flag and a grid.
    const response = buildTimingSystemResponse();

    // Act: read the path from it.
    const valueAtPath = readValueAtPath(response, path);

    // Assert: what was found, or that nothing was there.
    expect(valueAtPath, `reading "${path}" must give this answer`).toEqual(expected);
  });

  it('refuses a broken path instead of reading something else', () => {
    // Arrange: the same response, and a path with a bracket that never closes.
    const response = buildTimingSystemResponse();

    // Act: read it.
    const valueAtPath = readValueAtPath(response, 'dados.corrida.carros[1.equipe');

    // Assert: the path is refused with the same sentence parseValuePath gives.
    expect(valueAtPath, 'a broken path must be refused, not read').toEqual({
      outcome: 'pathRefused',
      reason: 'O caminho "dados.corrida.carros[1.equipe" abre um colchete e não fecha.',
    });
  });
});

describe('parseValuePath', () => {
  it('splits a path into keys and indices, in order', () => {
    // Arrange: a path with keys, an index and a key after it.
    const path = 'dados.corrida.carros[3].equipe';

    // Act: parse it.
    const parsing = parseValuePath(path);

    // Assert: four keys and one index, in the order they are walked.
    expect(parsing, 'the path must split into its keys and its index').toEqual({
      ok: true,
      segments: [
        { kind: 'key', key: 'dados' },
        { kind: 'key', key: 'corrida' },
        { kind: 'key', key: 'carros' },
        { kind: 'index', index: 3 },
        { kind: 'key', key: 'equipe' },
      ],
    });
  });

  const refusedPathScenarios: Array<{ name: string; path: string; expectedReason: string }> = [
    // A rule with an empty path would read the whole response as one field.
    {
      name: 'refuses an empty path',
      path: '',
      expectedReason: 'O caminho está vazio.',
    },
    // Two dots in a row are a typo, never a key with no name.
    {
      name: 'refuses an empty segment between two dots',
      path: 'dados..corrida',
      expectedReason:
        'O caminho "dados..corrida" tem um trecho vazio: um ponto no começo, no fim, ou dois pontos seguidos.',
    },
    // A trailing dot is the same typo at the end.
    {
      name: 'refuses a path that ends with a dot',
      path: 'dados.corrida.',
      expectedReason:
        'O caminho "dados.corrida." tem um trecho vazio: um ponto no começo, no fim, ou dois pontos seguidos.',
    },
    // A bracket left open is where a reader cannot tell what was meant.
    {
      name: 'refuses an unclosed bracket',
      path: 'carros[3',
      expectedReason: 'O caminho "carros[3" abre um colchete e não fecha.',
    },
    // A closing bracket on its own is a typo too.
    {
      name: 'refuses a closing bracket that never opened',
      path: 'carros3].equipe',
      expectedReason: 'O caminho "carros3].equipe" fecha um colchete que não abriu.',
    },
    // There is no "count from the end" in a path.
    {
      name: 'refuses a negative index',
      path: 'carros[-1].equipe',
      expectedReason:
        'O caminho "carros[-1].equipe" tem um índice negativo; os índices começam em [0].',
    },
    // An empty index is not "every element": there are no wildcards.
    {
      name: 'refuses an empty index',
      path: 'carros[].equipe',
      expectedReason: 'O caminho "carros[].equipe" tem um índice vazio, [].',
    },
    // A wildcard is refused with the sentence that says wildcards do not exist.
    {
      name: 'refuses a wildcard index',
      path: 'carros[*].equipe',
      expectedReason:
        'O caminho "carros[*].equipe" tem um índice que não é um número inteiro; curingas e filtros não existem, só índices como [3].',
    },
    // A filter is refused the same way: a path never chooses by content.
    {
      name: 'refuses a filter written as an index',
      path: 'carros[carro=31].equipe',
      expectedReason:
        'O caminho "carros[carro=31].equipe" tem um índice que não é um número inteiro; curingas e filtros não existem, só índices como [3].',
    },
    // A path starting with an index has no key to index into; a top-level list is out of scope.
    {
      name: 'refuses an index with no key before it',
      path: '[0].equipe',
      expectedReason:
        'O caminho "[0].equipe" tem um índice sem nome antes dele: escreva como carros[3].',
    },
    // Text glued after an index is a missing dot, not a key.
    {
      name: 'refuses text right after an index',
      path: 'carros[3]equipe',
      expectedReason:
        'O caminho "carros[3]equipe" tem texto logo depois de um índice: separe com um ponto, como carros[3].equipe.',
    },
    // An index past what a number can hold exactly would point at the wrong element.
    {
      name: 'refuses an index too large to read exactly',
      path: 'carros[99999999999999999999]',
      expectedReason: 'O caminho "carros[99999999999999999999]" tem um índice grande demais.',
    },
  ];

  it.each(refusedPathScenarios)('$name', ({ path, expectedReason }) => {
    // Arrange: nothing to set up; the path is the row's.

    // Act: parse it, as a config does when it is saved.
    const parsing = parseValuePath(path);

    // Assert: refused, with the pt-BR sentence saying what is wrong.
    expect(parsing, `"${path}" must be refused with this reason`).toEqual({
      ok: false,
      reason: expectedReason,
    });
  });
});
