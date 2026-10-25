/**
 * What a binding must say to make sense (packages/shared)
 *
 * What this module is for:
 *   The binding schema checks the shape of a binding (a source, a shape, a path,
 *   isLive). findProblemInBinding checks that its parts make sense together: the path
 *   is one the picker lists for that shape, a car chosen by number has its number (and
 *   only such a path has one), and a transform, when there is one, exists and has
 *   good parameters. It answers one pt-BR sentence, or undefined when all is well. The
 *   server runs it when an item is saved, naming the field before the sentence; the
 *   item editor runs it before sending.
 *
 * What these tests prove:
 *   - Bindings the editor builds pass: the flag, the whole clock, a place, a car by number.
 *   - Each mistake is refused with its own sentence: a path not listed for the shape, a
 *     car path without a car number, a car number on a fixed place, an unknown
 *     transform, parameters without a transform, a transform with bad parameters, a
 *     mapping transform, and a transform that does not read the path's type; and for a
 *     second transform (BAJAOVRLAY-47): one with no first, parameters with no second,
 *     the same transform twice, bad parameters, and one that does not read what the
 *     first gives.
 *   - findValueTypeOfBinding gives the type of value the binding reads, after its
 *     transforms (in order) when it has them.
 *
 * What these tests deliberately do not cover:
 *   - Whether the source exists; that needs the dataSources slice, the server checks it.
 *   - Whether the value fits the graphic's field; bindingFitsGraphicField.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { BindingFieldValue } from './bindingFieldValue.js';
import { findProblemInBinding, findValueTypeOfBinding } from './bindingProblems.js';

/** A live binding to the simulator's session, at the path given. */
function buildLiveBindingToTheSimulatorSession(path: string): BindingFieldValue {
  return { kind: 'binding', sourceId: 'simulador-enduro', shapeKey: 'session', path, isLive: true };
}

/** A live binding to the simulator's positions, at the path given. */
function buildLiveBindingToTheSimulatorPositions(path: string): BindingFieldValue {
  return {
    kind: 'binding',
    sourceId: 'simulador-enduro',
    shapeKey: 'positions',
    path,
    isLive: true,
  };
}

describe('findProblemInBinding', () => {
  const bindingsThatMakeSense: Array<{ name: string; binding: BindingFieldValue }> = [
    // The race clock's flag following the simulator: the E2E's binding.
    { name: 'the session flag', binding: buildLiveBindingToTheSimulatorSession('state') },
    // "Relógio da fonte": the whole clock, one binding for four fields.
    { name: 'the whole session clock', binding: buildLiveBindingToTheSimulatorSession('clock') },
    // A lower third naming whoever leads, frozen at the take.
    {
      name: 'the team in 1st place, frozen at the take',
      binding: { ...buildLiveBindingToTheSimulatorPositions('entries.0.teamName'), isLive: false },
    },
    // A team card that follows car 42 wherever it runs.
    {
      name: 'the laps of car 42 chosen by its number',
      binding: { ...buildLiveBindingToTheSimulatorPositions('entryOfCar.laps'), carNumber: 42 },
    },
    // The podium: the first three cars, then each crowned by its team's logo (BAJAOVRLAY-47).
    {
      name: 'the first three cars, then their teams’ logos, frozen at the take',
      binding: {
        ...buildLiveBindingToTheSimulatorPositions('entries'),
        isLive: false,
        transformId: 'topN',
        transformParameters: { n: 3 },
        thenTransformId: 'withTeamLogos',
      },
    },
  ];

  it.each(bindingsThatMakeSense)('finds nothing wrong with $name', ({ binding }) => {
    // Arrange: the binding from the table above.

    // Act: check it.
    const problem = findProblemInBinding(binding);

    // Assert: no problem.
    expect(problem, 'a binding the editor builds must pass').toBeUndefined();
  });

  const bindingsWithAProblem: Array<{
    name: string;
    binding: BindingFieldValue;
    expectedProblem: string;
  }> = [
    // A path the picker never offered (typed by hand through the API, or from an older
    // list): it would read nothing at the take.
    {
      name: 'refuses a path the session does not list',
      binding: buildLiveBindingToTheSimulatorSession('bandeira'),
      expectedProblem: 'O caminho "bandeira" não é um dos que a forma Sessão oferece.',
    },
    // The 11th place has no path of its own; the whole list covers it.
    {
      name: 'refuses the 11th place, which is past the listed places',
      binding: buildLiveBindingToTheSimulatorPositions('entries.10.teamName'),
      expectedProblem: 'O caminho "entries.10.teamName" não é um dos que a forma Posições oferece.',
    },
    // A car chosen by number with no number would follow no car.
    {
      name: 'refuses a car chosen by number with no car number',
      binding: buildLiveBindingToTheSimulatorPositions('entryOfCar.teamName'),
      expectedProblem: 'Falta o número do carro a seguir.',
    },
    // A number on a fixed place would be ignored, and the operator would believe the
    // field follows that car.
    {
      name: 'refuses a car number on the 1st place, which does not read it',
      binding: { ...buildLiveBindingToTheSimulatorPositions('entries.0.teamName'), carNumber: 42 },
      expectedProblem:
        'O número do carro só vale para os caminhos de "Carro escolhido pelo número".',
    },
    // A transform the registry does not have: architecture rule 5.
    {
      name: 'refuses a transform the registry does not have',
      binding: {
        ...buildLiveBindingToTheSimulatorSession('sessionName'),
        transformId: 'maiusculas',
      },
      expectedProblem: 'A transformação "maiusculas" não existe.',
    },
    // Parameters with no transform to read them would be ignored.
    {
      name: 'refuses transform parameters with no transform',
      binding: {
        ...buildLiveBindingToTheSimulatorSession('sessionName'),
        transformParameters: { maxLength: 12 },
      },
      expectedProblem: 'Há parâmetros de transformação, mas nenhuma transformação escolhida.',
    },
    // The registry's own check of the parameters, at save time and not on air.
    {
      name: 'refuses a transform with bad parameters',
      binding: {
        ...buildLiveBindingToTheSimulatorPositions('entries'),
        transformId: 'topN',
        transformParameters: { n: 0 },
      },
      expectedProblem: 'O número de entradas deve ser um inteiro de 1 a 60.',
    },
    // A mapping transform reads a source's own format; canonical data is already read.
    {
      name: 'refuses a mapping transform',
      binding: {
        ...buildLiveBindingToTheSimulatorSession('state'),
        transformId: 'mapValues',
        transformParameters: { green: 'VERDE' },
      },
      expectedProblem:
        'A transformação "Tabela de valores" serve para mapear uma fonte, não para vincular campos de um gráfico.',
    },
    // A lap-time format on a text: it would be refused on air at every refresh.
    {
      name: 'refuses a transform that does not read the type of the path',
      binding: {
        ...buildLiveBindingToTheSimulatorSession('sessionName'),
        transformId: 'formatLapTimeAsText',
      },
      expectedProblem:
        'A transformação "Tempo de volta como texto" não se aplica a Sessão › Nome da sessão.',
    },
    // A second transform alone: a single transform is always written as the first, so a
    // stored binding says one thing one way only.
    {
      name: 'refuses a second transform with no first',
      binding: {
        ...buildLiveBindingToTheSimulatorPositions('entries'),
        thenTransformId: 'withTeamLogos',
      },
      expectedProblem: 'Há uma segunda transformação, mas nenhuma primeira.',
    },
    // Parameters for a second transform that is not there would be ignored.
    {
      name: 'refuses second-transform parameters with no second transform',
      binding: {
        ...buildLiveBindingToTheSimulatorPositions('entries'),
        transformId: 'topN',
        transformParameters: { n: 3 },
        thenTransformParameters: { n: 3 },
      },
      expectedProblem:
        'Há parâmetros da segunda transformação, mas nenhuma segunda transformação escolhida.',
    },
    // The second transform's parameters get the registry's check too.
    {
      name: 'refuses a second transform with bad parameters',
      binding: {
        ...buildLiveBindingToTheSimulatorPositions('entries'),
        transformId: 'withTeamLogos',
        thenTransformId: 'topN',
        thenTransformParameters: { n: 0 },
      },
      expectedProblem: 'O número de entradas deve ser um inteiro de 1 a 60.',
    },
    // The same transform twice: withTeamLogos again adds nothing, topN again only confuses.
    {
      name: 'refuses the same transform as first and second',
      binding: {
        ...buildLiveBindingToTheSimulatorPositions('entries'),
        transformId: 'withTeamLogos',
        thenTransformId: 'withTeamLogos',
      },
      expectedProblem:
        'A segunda transformação não pode repetir a primeira ("Com logos das equipes").',
    },
    // The second reads what the first gives: a lap written as text is no list of cars.
    {
      name: 'refuses a second transform that does not read what the first gives',
      binding: {
        ...buildLiveBindingToTheSimulatorPositions('entries.0.lastLapMs'),
        transformId: 'formatLapTimeAsText',
        thenTransformId: 'withTeamLogos',
      },
      expectedProblem:
        'A transformação "Com logos das equipes" não se aplica ao que "Tempo de volta como texto" entrega.',
    },
  ];

  it.each(bindingsWithAProblem)('$name', ({ binding, expectedProblem }) => {
    // Arrange: the binding from the table above.

    // Act: check it.
    const problem = findProblemInBinding(binding);

    // Assert: the pt-BR sentence that says what is wrong.
    expect(problem, 'the problem must be named in pt-BR').toBe(expectedProblem);
  });
});

describe('findValueTypeOfBinding', () => {
  it('reads the flag as the race clock flag type, and the whole clock as the clock group', () => {
    // Arrange: the two bindings of "Relógio da fonte" with the flag.
    const flagBinding = buildLiveBindingToTheSimulatorSession('state');
    const clockBinding = buildLiveBindingToTheSimulatorSession('clock');

    // Act: ask the type of each.
    const flagType = findValueTypeOfBinding(flagBinding);
    const clockType = findValueTypeOfBinding(clockBinding);

    // Assert: the types the editor filters fields with.
    expect(flagType, 'the flag must read as the race clock flag').toBe('stateEnum');
    expect(clockType, 'the whole clock must read as the clock group').toBe('clockGroup');
  });

  it('gives the type a transform gives, not the type of the path', () => {
    // Arrange: the leader's last lap written as text, and the top six of the positions.
    const lastLapAsText: BindingFieldValue = {
      ...buildLiveBindingToTheSimulatorPositions('entries.0.lastLapMs'),
      transformId: 'formatLapTimeAsText',
    };
    const topSix: BindingFieldValue = {
      ...buildLiveBindingToTheSimulatorPositions('entries'),
      transformId: 'topN',
      transformParameters: { n: 6 },
    };

    // Act: ask the type of each.
    const lastLapType = findValueTypeOfBinding(lastLapAsText);
    const topSixType = findValueTypeOfBinding(topSix);

    // Assert: a text for the lap, and still the positions list for the top six.
    expect(lastLapType, 'a formatted lap time is text').toBe('text');
    expect(topSixType, 'topN gives back the list it read').toBe('positionsEntries');
  });

  it('follows both transforms in order', () => {
    // Arrange: the leader's last lap written as text then shortened, and the podium's
    // first three cars with their logos.
    const lastLapShortened: BindingFieldValue = {
      ...buildLiveBindingToTheSimulatorPositions('entries.0.lastLapMs'),
      transformId: 'formatLapTimeAsText',
      thenTransformId: 'shortenSchoolName',
      thenTransformParameters: { maxLength: 12 },
    };
    const podiumWithLogos: BindingFieldValue = {
      ...buildLiveBindingToTheSimulatorPositions('entries'),
      transformId: 'topN',
      transformParameters: { n: 3 },
      thenTransformId: 'withTeamLogos',
    };

    // Act: ask the type of each.
    const lastLapType = findValueTypeOfBinding(lastLapShortened);
    const podiumType = findValueTypeOfBinding(podiumWithLogos);

    // Assert: text after text, and still the positions list after two list transforms.
    expect(lastLapType, 'text shortened is still text').toBe('text');
    expect(podiumType, 'topN then withTeamLogos give back the list read').toBe('positionsEntries');
  });

  it('answers undefined for a path that is not listed', () => {
    // Arrange: a path the session does not offer.
    const binding = buildLiveBindingToTheSimulatorSession('bandeira');

    // Act: ask its type.
    const valueType = findValueTypeOfBinding(binding);

    // Assert: no type, so no field can take it.
    expect(valueType, 'an unlisted path has no type').toBeUndefined();
  });
});
