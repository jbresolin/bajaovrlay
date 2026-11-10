/**
 * Bindings to the match "agora" and the match "a seguir" (packages/shared)
 *
 * What this module is for:
 *   The match bug and the "a seguir" card bind their fields to "Chaves › Partida agora"
 *   and "Chaves › Partida a seguir" (BAJAOVRLAY-65). resolveBindingAgainstSources reads
 *   such a binding from the match the operator put in that slot of the match focus, in
 *   the brackets the source sends now, joined with Cadastros by car number (the team
 *   card's join). Graphics still receive resolved data only.
 *
 * What these tests prove:
 *   - The join: a car's logo and city come from Cadastros; a team missing from Cadastros
 *     keeps the bracket's short name as its team name, and its logo and city read as
 *     absent (an optional field leaves the air), never as an error.
 *   - Every listed path of both slots reads a value from a match whose every part is
 *     known, so no path names a field the focused match does not have.
 *   - An empty slot, a focus chosen in another session and a chosen match the source no
 *     longer lists read as absent, with a pt-BR reason: the graphics show nothing rather
 *     than a stale match.
 *   - These bindings read the teams, so a Cadastros edit refreshes them on air.
 *
 * What these tests deliberately do not cover:
 *   - The live refresh when the focus or the brackets change: the server's tests
 *     (modules/bindings and modules/bracketMatchFocus).
 *   - Which match is suggested: bracketMatchSuggestions.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { BracketMatchFocus } from '../bracketMatchFocus/bracketMatchFocus.js';
import {
  buildBestOfThreeUnderWay,
  buildQuarterFinals,
  buildSuperPrimeBrackets,
  superPrimeCars,
} from '../bracketMatchFocus/superPrimeBrackets.testSupport.js';
import { listBindablePathsOfShape } from '../dataShapes/bindablePaths.js';
import type { BracketRound } from '../dataShapes/index.js';
import type { Team } from '../entities/team.js';
import { buildFakeMediaId } from '../media/fakeMediaIds.testSupport.js';
import type { BindingFieldValue } from './bindingFieldValue.js';
import {
  doesBindingReadTheTeams,
  resolveBindingAgainstSources,
  type SourcesForBindings,
} from './bindingResolution.js';
import { buildSimulatorSource, simulatorSourceId } from './sourcesForBindingTests.testSupport.js';

const cars = superPrimeCars;

/** The media id of Corisco's logo in the media store. */
const logoOfCoriscoMediaId = buildFakeMediaId(32);

/** Cadastros as the event has it: Corisco (car 32) with its city and logo, Pequi missing. */
function buildTeamsInCadastros(): Team[] {
  return [
    {
      carNumber: 32,
      teamName: 'Corisco Baja UPE',
      schoolName: 'UPE',
      city: 'Recife',
      state: 'PE',
      logoMediaId: logoOfCoriscoMediaId,
    },
  ];
}

/** The quarter-finals decided, and the first semifinal at 1 × 1: Corisco against Pequi. */
function buildRoundsWithTheFirstSemifinalAtOneAll(): BracketRound[] {
  return [
    buildQuarterFinals({
      'qf-1': cars.corisco,
      'qf-2': cars.pequi,
      'qf-3': cars.cactus,
      'qf-4': cars.ufsc,
    }),
    {
      name: 'Semifinal',
      matches: [
        buildBestOfThreeUnderWay('sf-1', cars.corisco, 1, cars.pequi, 1),
        {
          matchId: 'sf-2',
          bestOf: 3,
          carA: { ...cars.cactus, wins: 0 },
          carB: { ...cars.ufsc, wins: 0 },
        },
      ],
    },
  ];
}

/** The simulator sending these rounds, with the operator's focus given (or none). */
function buildSourcesWithTheSuperPrime(
  rounds: BracketRound[],
  focus: BracketMatchFocus | undefined,
): SourcesForBindings {
  return {
    dataSources: [buildSimulatorSource(false)],
    dataSnapshots: [
      {
        sourceId: simulatorSourceId,
        receivedAtMs: 1_793_552_400_000,
        shapes: { brackets: buildSuperPrimeBrackets(rounds) },
      },
    ],
    overrides: [],
    bracketMatchFocuses: focus === undefined ? [] : [focus],
  };
}

/** The operator's focus: sf-1 "agora", sf-2 "a seguir", in today's session. */
function buildFocusOnTheSemifinals(): BracketMatchFocus {
  return {
    sourceId: simulatorSourceId,
    sessionId: 'super-prime-30a-competicao',
    currentMatchId: 'sf-1',
    upNextMatchId: 'sf-2',
  };
}

/** A live binding to one path of the brackets of the simulator. */
function buildBracketsBinding(path: string): BindingFieldValue {
  return { kind: 'binding', sourceId: simulatorSourceId, shapeKey: 'brackets', path, isLive: true };
}

describe('resolveBindingAgainstSources on the match focus', () => {
  const joinScenarios = [
    {
      // The bug's first car: the bracket's own short name.
      name: 'reads the short name of the car "agora" from the bracket',
      path: 'matchNow.carA.shortName',
      expected: { status: 'resolved', value: 'Corisco', isOverridden: false },
    },
    {
      // The card's team name: Cadastros' full name for a team it knows.
      name: 'reads the team name of a car in Cadastros from Cadastros',
      path: 'matchNow.carA.teamName',
      expected: { status: 'resolved', value: 'Corisco Baja UPE', isOverridden: false },
    },
    {
      // The logo is joined from Cadastros by car number, as the team card does.
      name: 'reads the logo of a car in Cadastros as its /media address',
      path: 'matchNow.carA.logoUrl',
      expected: {
        status: 'resolved',
        value: `/media/${logoOfCoriscoMediaId}`,
        isOverridden: false,
      },
    },
    {
      // The city too: the bracket never carries it.
      name: 'reads the city of a car in Cadastros',
      path: 'matchNow.carA.city',
      expected: { status: 'resolved', value: 'Recife', isOverridden: false },
    },
    {
      // Pequi is not in Cadastros: its name falls back to the bracket's short name.
      name: 'reads the short name as the team name of a car missing from Cadastros',
      path: 'matchNow.carB.teamName',
      expected: { status: 'resolved', value: 'Pequi', isOverridden: false },
    },
    {
      // Pequi has no logo anywhere: absent, so the card draws its car-number chip instead.
      name: 'reads the logo of a car missing from Cadastros as absent',
      path: 'matchNow.carB.logoUrl',
      expected: {
        status: 'valueAbsent',
        problem: 'a fonte Simulador — Enduro não tem valor em Chaves › Partida agora › Carro B › Logo.',
      },
    },
    {
      // The score of the best of 3 so far.
      name: 'reads the wins of the car "agora"',
      path: 'matchNow.carB.wins',
      expected: { status: 'resolved', value: 1, isOverridden: false },
    },
    {
      // "a seguir" reads its own slot: the second semifinal.
      name: 'reads the round of the match "a seguir" from its own slot',
      path: 'matchUpNext.carA.shortName',
      expected: { status: 'resolved', value: 'Cactus', isOverridden: false },
    },
  ];

  it.each(joinScenarios)('$name', ({ path, expected }) => {
    // Arrange: the semifinals under way, sf-1 "agora" and sf-2 "a seguir".
    const sources = buildSourcesWithTheSuperPrime(
      buildRoundsWithTheFirstSemifinalAtOneAll(),
      buildFocusOnTheSemifinals(),
    );

    // Act: read the binding, with Cadastros as the event has it.
    const resolution = resolveBindingAgainstSources(buildBracketsBinding(path), sources, {
      teams: buildTeamsInCadastros(),
    });

    // Assert: the value of the focused match, joined with Cadastros.
    expect(resolution, 'the focused match must be read and joined with Cadastros').toEqual(
      expected,
    );
  });

  it('reads a value at every listed path of both slots from a match whose every part is known', () => {
    // Arrange: a decided best of 3 with times and wins (not a real result: a match that
    // carries everything a path can name), both cars in Cadastros with city and logo.
    const fullyKnownMatch = {
      matchId: 'sf-1',
      bestOf: 3,
      carA: { ...cars.corisco, wins: 2, timeMs: 41_870 },
      carB: { ...cars.pequi, wins: 1, timeMs: 43_215 },
      winnerCarNumber: 32,
    };
    const sources = buildSourcesWithTheSuperPrime(
      [{ name: 'Semifinal', matches: [fullyKnownMatch] }],
      { ...buildFocusOnTheSemifinals(), upNextMatchId: 'sf-1', currentMatchId: 'sf-1' },
    );
    const teams: Team[] = [
      ...buildTeamsInCadastros(),
      {
        carNumber: 12,
        teamName: 'Pequi Baja UnB',
        schoolName: 'UnB',
        city: 'Brasília',
        state: 'DF',
        logoMediaId: buildFakeMediaId(12),
      },
    ];
    const focusPaths = listBindablePathsOfShape('brackets').filter(
      (bindablePath) => bindablePath.bracketMatchSlot !== undefined,
    );

    // Act: read every path of both slots.
    const pathsReadingNothing = focusPaths
      .map((bindablePath) => bindablePath.path)
      .filter((path) => {
        const resolution = resolveBindingAgainstSources(buildBracketsBinding(path), sources, {
          teams,
        });
        return resolution.status !== 'resolved';
      });

    // Assert: none; a mistyped path would be offered in the picker and read nothing.
    expect(pathsReadingNothing, 'every focus path must name a field of the match').toEqual([]);
  });

  const absentScenarios = [
    {
      // Nothing was chosen for this source yet.
      name: 'reads a slot never chosen as absent',
      focus: undefined,
      expectedProblem: 'nenhuma partida escolhida para Partida agora.',
    },
    {
      // "agora" was emptied by the operator.
      name: 'reads an emptied slot as absent',
      focus: { ...buildFocusOnTheSemifinals(), currentMatchId: undefined },
      expectedProblem: 'nenhuma partida escolhida para Partida agora.',
    },
    {
      // The focus was chosen in an earlier session: never a match of another day.
      name: 'reads a focus of another session as absent',
      focus: { ...buildFocusOnTheSemifinals(), sessionId: 'super-prime-29a-competicao' },
      expectedProblem: 'nenhuma partida escolhida para Partida agora.',
    },
    {
      // The operator chose a match the source then stopped listing.
      name: 'reads a chosen match the source no longer lists as absent, naming it',
      focus: { ...buildFocusOnTheSemifinals(), currentMatchId: 'sf-9' },
      expectedProblem: 'a partida escolhida para Partida agora (sf-9) saiu da chave.',
    },
  ];

  it.each(absentScenarios)('$name', ({ focus, expectedProblem }) => {
    // Arrange: the semifinals under way, with this row's focus.
    const sources = buildSourcesWithTheSuperPrime(buildRoundsWithTheFirstSemifinalAtOneAll(), focus);

    // Act: read the short name of the first car "agora".
    const resolution = resolveBindingAgainstSources(
      buildBracketsBinding('matchNow.carA.shortName'),
      sources,
      { teams: buildTeamsInCadastros() },
    );

    // Assert: absent, so the graphic shows nothing, with the reason for the operator.
    expect(resolution, 'an empty slot must read as absent, never as a stale match').toEqual({
      status: 'valueAbsent',
      problem: expectedProblem,
    });
  });
});

describe('doesBindingReadTheTeams on the match focus', () => {
  it('says a binding to the match "agora" reads the teams, so a Cadastros edit refreshes it', () => {
    // Arrange: the card's logo binding, with no transform.
    const binding = buildBracketsBinding('matchUpNext.carA.logoUrl');

    // Act: ask whether it reads the teams.
    const readsTheTeams = doesBindingReadTheTeams(binding);

    // Assert: yes: the logo comes from Cadastros.
    expect(readsTheTeams, 'a focus binding joins Cadastros, so it reads the teams').toBe(true);
  });

  it('says a binding to the rounds does not read the teams', () => {
    // Arrange: the bracket graphic's binding to every round.
    const binding = buildBracketsBinding('rounds');

    // Act: ask whether it reads the teams.
    const readsTheTeams = doesBindingReadTheTeams(binding);

    // Assert: no: the rounds come from the source alone.
    expect(readsTheTeams, 'the rounds are read from the source alone').toBe(false);
  });
});
