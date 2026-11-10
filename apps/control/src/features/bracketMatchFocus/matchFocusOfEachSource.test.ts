/**
 * What "Partidas da chave" shows for each source (apps/control)
 *
 * What this module is for:
 *   The console's "Partidas da chave" (BAJAOVRLAY-65) shows, for every source that sends a
 *   Super Prime, the match "agora" and the match "a seguir", the list of every match to
 *   choose from, and, when the match "agora" has its winner, a proposal of the next one.
 *   matchFocusOfEachSource.ts reads all of that from the slices, so the panel only draws.
 *
 * What these tests prove:
 *   - Only sources that send brackets are listed.
 *   - The list: every raced match in play order with its round, its progress (encerrada,
 *     em andamento, a definir) and the suggested ones marked.
 *   - The slots: a chosen match, an empty slot, a focus of another session (empty), and a
 *     chosen match the source stopped listing (gone, named).
 *   - The proposal: nothing while "agora" runs; once it has a winner, the winner and the
 *     suggested next match; nothing left to suggest after the final; and, with "agora"
 *     empty, the suggestion alone.
 *
 * What these tests deliberately do not cover:
 *   - Which match is suggested in each situation: shared's bracketMatchSuggestions.test.ts.
 *   - The panel's buttons and the commands they send: BracketMatchFocusPanel.test.tsx.
 */
import type { BracketMatchFocus, BracketRound, DataSnapshot } from '@bajaovrlay/shared';
import {
  buildQuarterFinals,
  buildSuperPrimeBrackets,
  superPrimeCars,
} from '@bajaovrlay/shared/superPrimeBrackets.testSupport';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { describeMatchFocusOfEachSource } from './matchFocusOfEachSource';

const cars = superPrimeCars;

/** The simulator's snapshot holding these rounds of today's Super Prime. */
function buildSnapshotWithRounds(rounds: BracketRound[]): DataSnapshot {
  return {
    sourceId: 'simulador-enduro',
    receivedAtMs: 1_793_552_400_000,
    shapes: { brackets: buildSuperPrimeBrackets(rounds) },
  };
}

/** The simulator's focus in today's session. */
function buildFocus(currentMatchId?: string, upNextMatchId?: string): BracketMatchFocus {
  return {
    sourceId: 'simulador-enduro',
    sessionId: 'super-prime-30a-competicao',
    ...(currentMatchId === undefined ? {} : { currentMatchId }),
    ...(upNextMatchId === undefined ? {} : { upNextMatchId }),
  };
}

/** Reads what the panel shows for the simulator alone. */
function describeTheSimulator(rounds: BracketRound[], focus: BracketMatchFocus | undefined) {
  const [simulator] = describeMatchFocusOfEachSource({
    dataSources: [buildSimulatorThatIsOk()],
    dataSnapshots: [buildSnapshotWithRounds(rounds)],
    bracketMatchFocuses: focus === undefined ? [] : [focus],
  });
  if (simulator === undefined) {
    throw new Error('the simulator must be listed');
  }
  return simulator;
}

describe('the sources listed', () => {
  it('lists only a source that sends brackets', () => {
    // Arrange: the simulator sending the enduro only (no Super Prime).
    const slices = {
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34('simulador-enduro')],
      bracketMatchFocuses: [],
    };

    // Act: read what the panel shows.
    const sources = describeMatchFocusOfEachSource(slices);

    // Assert: nothing: there is no match to choose.
    expect(sources, 'a source without brackets has no match to show').toEqual([]);
  });
});

describe('the list of matches', () => {
  it('lists every match in play order with its round, progress and the suggestions marked', () => {
    // Arrange: qf-1 decided, qf-2 under way (a time in), qf-3 and qf-4 not started.
    const quarterFinals = buildQuarterFinals({ 'qf-1': cars.corisco });
    const [qf1, qf2, ...rest] = quarterFinals.matches;
    const qf2UnderWay = { ...qf2!, carA: { ...qf2!.carA, timeMs: 41_870 } };
    const rounds = [{ ...quarterFinals, matches: [qf1!, qf2UnderWay, ...rest] }];

    // Act: read what the panel shows.
    const simulator = describeTheSimulator(rounds, undefined);

    // Assert: four rows, each with what the list shows.
    expect(
      simulator.matches.map((row) => [
        row.matchId,
        row.matchText,
        row.progress,
        row.suggestedFor,
      ]),
      'every match, in the source\'s order, with its progress and suggestion',
    ).toEqual([
      ['qf-1', 'Corisco × Buffalo (Quartas de final)', 'decided', undefined],
      ['qf-2', 'Pequi × Acauã (Quartas de final)', 'running', 'current'],
      ['qf-3', 'Cactus × Baja UFMG (Quartas de final)', 'notStarted', 'upNext'],
      ['qf-4', 'Piratas Cerrado × UFSC (Quartas de final)', 'notStarted', undefined],
    ]);
  });
});

describe('the two slots', () => {
  const slotScenarios = [
    {
      // Both chosen: each slot names its match.
      name: 'names the matches chosen for both slots',
      focus: buildFocus('qf-1', 'qf-2'),
      expected: {
        current: { kind: 'chosen', matchText: 'Corisco × Buffalo (Quartas de final)' },
        upNext: { kind: 'chosen', matchText: 'Pequi × Acauã (Quartas de final)' },
      },
    },
    {
      // Nothing chosen yet.
      name: 'reads both slots as empty before any choice',
      focus: undefined,
      expected: { current: { kind: 'empty' }, upNext: { kind: 'empty' } },
    },
    {
      // Chosen yesterday: today's page must not show it.
      name: 'reads a focus of another session as empty',
      focus: { ...buildFocus('qf-1', 'qf-2'), sessionId: 'super-prime-29a-competicao' },
      expected: { current: { kind: 'empty' }, upNext: { kind: 'empty' } },
    },
    {
      // The source stopped listing the chosen match: the page says which one went.
      name: 'reads a chosen match the source no longer lists as gone, by its id',
      focus: buildFocus('qf-9'),
      expected: { current: { kind: 'gone', matchId: 'qf-9' }, upNext: { kind: 'empty' } },
    },
  ];

  it.each(slotScenarios)('$name', ({ focus, expected }) => {
    // Arrange: the quarter-finals, nothing decided, with this row's focus.
    const rounds = [buildQuarterFinals()];

    // Act: read what the panel shows.
    const simulator = describeTheSimulator(rounds, focus);

    // Assert: each slot as expected.
    const readSlot = (slot: typeof simulator.current) =>
      slot.kind === 'chosen' ? { kind: slot.kind, matchText: slot.match.matchText } : slot;
    expect(
      { current: readSlot(simulator.current), upNext: readSlot(simulator.upNext) },
      'each slot must say what it holds',
    ).toEqual(expected);
  });
});

describe('the proposal', () => {
  it('proposes nothing while the match "agora" runs', () => {
    // Arrange: qf-1 "agora", undecided.
    const rounds = [buildQuarterFinals()];

    // Act: read what the panel shows.
    const simulator = describeTheSimulator(rounds, buildFocus('qf-1', 'qf-2'));

    // Assert: no proposal: the focus never moves by itself, and nothing asks to.
    expect(simulator.proposal, 'nothing to propose while "agora" runs').toBeUndefined();
  });

  it('proposes the next match once the match "agora" has its winner', () => {
    // Arrange: qf-1 "agora", and Corisco has just won it.
    const rounds = [buildQuarterFinals({ 'qf-1': cars.corisco })];

    // Act: read what the panel shows.
    const simulator = describeTheSimulator(rounds, buildFocus('qf-1', 'qf-2'));

    // Assert: the winner and the suggested next match.
    expect(simulator.proposal, 'the page must propose the next match').toEqual({
      kind: 'currentDecided',
      winnerName: 'Corisco',
      suggestedMatchText: 'Pequi × Acauã (Quartas de final)',
    });
  });

  it('says nothing is left once the last match "agora" has its winner', () => {
    // Arrange: every quarter-final decided (this Super Prime ends there), qf-4 "agora".
    const rounds = [
      buildQuarterFinals({
        'qf-1': cars.corisco,
        'qf-2': cars.pequi,
        'qf-3': cars.cactus,
        'qf-4': cars.ufsc,
      }),
    ];

    // Act: read what the panel shows.
    const simulator = describeTheSimulator(rounds, buildFocus('qf-4'));

    // Assert: the winner, and no next match.
    expect(simulator.proposal, 'nothing is left to propose').toEqual({
      kind: 'currentDecided',
      winnerName: 'UFSC',
      suggestedMatchText: undefined,
    });
  });

  it('proposes the suggestion when nothing is "agora"', () => {
    // Arrange: the quarter-finals, nothing chosen.
    const rounds = [buildQuarterFinals()];

    // Act: read what the panel shows.
    const simulator = describeTheSimulator(rounds, undefined);

    // Assert: the suggested first match.
    expect(simulator.proposal, 'an empty "agora" is offered the suggestion').toEqual({
      kind: 'nothingChosen',
      suggestedMatchText: 'Corisco × Buffalo (Quartas de final)',
    });
  });
});
