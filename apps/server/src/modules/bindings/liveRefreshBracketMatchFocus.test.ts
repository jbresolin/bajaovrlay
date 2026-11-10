/**
 * The match bug on air follows "agora", and "agora" never moves by itself (apps/server)
 *
 * What this module is for:
 *   The match bug binds its fields to "Chaves › Partida agora" (BAJAOVRLAY-65). The
 *   refresher of bound fields reads them again when the source's brackets change and
 *   when the operator moves the focus, so the bug on air follows "agora" at once. The
 *   focus itself is only ever moved by the operator: when the match "agora" gets its
 *   winner, the bug keeps showing it, with its result, until the operator moves on.
 *
 * What these tests prove:
 *   - Choosing another match "agora" changes the bug on air at once.
 *   - A winner arriving in the source leaves "agora" where it was, and the bug shows the
 *     same match with its winner.
 *   - A chosen match the source stops listing takes the bug's fields off the air, so the
 *     bug shows nothing rather than a stale match; the focus still names it.
 *
 * What these tests deliberately do not cover:
 *   - The commands' rules and refusals: modules/bracketMatchFocus.
 *   - Reading each path and the join with Cadastros: shared's
 *     bindingResolutionBracketMatchFocus.test.ts.
 *   - The real match bug's drawing: packages/graphics/bracket-match-bug.
 */
import type { BracketRound } from '@bajaovrlay/shared';
import {
  buildQuarterFinals,
  superPrimeCars,
} from '@bajaovrlay/shared/superPrimeBrackets.testSupport';
import { describe, expect, it } from 'vitest';

import { createGraphicsFolderWithBuiltPackage } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  enduroSimulatorId,
  momentOfTheCommandsMs,
  openStoreWithTheRefresher,
  operatorActor,
  readInstanceOn,
} from './liveRefresh.testSupport.js';

const cars = superPrimeCars;

/** The session of shared's Super Prime builders. */
const superPrimeSessionId = 'super-prime-30a-competicao';

/**
 * A stand-in match bug: the round, each car's number and short name, and the winner,
 * every field optional (an empty slot sends nothing). The real manifest lives in
 * packages/graphics/bracket-match-bug.
 */
const matchBugManifestForTests = {
  $schema: 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json',
  id: 'baja-bracket-match-bug',
  name: 'Partida da chave',
  description: 'A partida "agora" da chave, num canto da tela.',
  version: '0.1.0',
  main: 'bracket-match-bug.js',
  supportsRealTime: true,
  supportsNonRealTime: false,
  stepCount: 1,
  schema: {
    type: 'object',
    properties: {
      roundName: { type: 'string', title: 'Fase' },
      carAShortName: { type: 'string', title: 'Carro A — nome curto' },
      carBShortName: { type: 'string', title: 'Carro B — nome curto' },
      winnerCarNumber: { type: 'integer', title: 'Vencedor', minimum: 1 },
    },
    additionalProperties: false,
  },
};

/** A live binding to a path of the simulator's brackets. */
function buildBracketsBinding(path: string) {
  return {
    kind: 'binding' as const,
    sourceId: enduroSimulatorId,
    shapeKey: 'brackets' as const,
    path,
    isLive: true,
  };
}

/** A store with the refresher and the stand-in bug built, the simulator on. */
function openStoreWithTheMatchBug() {
  return openStoreWithTheRefresher(
    createGraphicsFolderWithBuiltPackage('bracket-match-bug', matchBugManifestForTests),
  );
}

/** Records one good poll of the simulator carrying these rounds, as its poller. */
function pollTheSimulatorWithRounds(stateStore: StateStore, rounds: BracketRound[]): void {
  applyOrThrow(
    stateStore,
    {
      type: 'recordDataSourcePoll',
      sourceId: enduroSimulatorId,
      result: {
        ok: true,
        shapes: {
          brackets: { sessionId: superPrimeSessionId, updatedAtMs: momentOfTheCommandsMs, rounds },
        },
        receivedAtMs: momentOfTheCommandsMs,
      },
    },
    buildDataSourcePollerActor(enduroSimulatorId),
  );
}

/** "Escolher partida" for "agora", as the page sends it. */
function chooseMatchNow(stateStore: StateStore, matchId: string): void {
  applyOrThrow(stateStore, {
    type: 'setBracketMatchFocus',
    sourceId: enduroSimulatorId,
    sessionId: superPrimeSessionId,
    slot: 'current',
    matchId,
  });
}

/** Creates the bug item bound to "agora" on the bug layer and takes it. */
function takeTheMatchBugBoundToNow(stateStore: StateStore): void {
  const outcome = stateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'bracket-match-bug',
      layerId: 'bug',
      label: 'Partida agora',
      fields: {
        roundName: buildBracketsBinding('matchNow.roundName'),
        carAShortName: buildBracketsBinding('matchNow.carA.shortName'),
        carBShortName: buildBracketsBinding('matchNow.carB.shortName'),
        winnerCarNumber: buildBracketsBinding('matchNow.winnerCarNumber'),
      },
    },
    operatorActor,
  );
  if (!outcome.ok || outcome.createdItemId === undefined) {
    throw new Error(`createItem was refused: ${JSON.stringify(outcome)}`);
  }
  applyOrThrow(stateStore, { type: 'takeItem', itemId: outcome.createdItemId });
}

/** What the bug shows on program now. */
function readTheBugOnAir(stateStore: StateStore): Record<string, unknown> | undefined {
  return readInstanceOn(stateStore, 'bug', 'program')?.resolvedData;
}

describe('the match bug bound to "agora"', () => {
  it('changes on air at once when the operator chooses another match', () => {
    // Arrange: qf-1 "agora", the bug on air showing it.
    const { stateStore, refreshTimer } = openStoreWithTheMatchBug();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()]);
    chooseMatchNow(stateStore, 'qf-1');
    takeTheMatchBugBoundToNow(stateStore);
    const bugBefore = readTheBugOnAir(stateStore);

    // Act: the operator puts qf-2 "agora", and the refresher runs.
    chooseMatchNow(stateStore, 'qf-2');
    refreshTimer.runThePendingRefresh();

    // Assert: Corisco × Buffalo before, Pequi × Acauã after.
    expect(bugBefore, 'the take must show qf-1').toEqual({
      roundName: 'Quartas de final',
      carAShortName: 'Corisco',
      carBShortName: 'Buffalo',
    });
    expect(readTheBugOnAir(stateStore), 'the bug must follow "agora" at once').toEqual({
      roundName: 'Quartas de final',
      carAShortName: 'Pequi',
      carBShortName: 'Acauã',
    });
  });

  it('keeps "agora" on the match that got its winner, and shows that winner', () => {
    // Arrange: qf-1 "agora", the bug on air showing it, undecided.
    const { stateStore, refreshTimer } = openStoreWithTheMatchBug();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()]);
    chooseMatchNow(stateStore, 'qf-1');
    takeTheMatchBugBoundToNow(stateStore);

    // Act: the source gives qf-1 to Corisco, and the refresher runs.
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals({ 'qf-1': cars.corisco })]);
    refreshTimer.runThePendingRefresh();

    // Assert: the focus did not move; the bug shows the same match, won by car 32.
    const focus = stateStore
      .readAllSlices()
      .bracketMatchFocuses.find((candidate) => candidate.sourceId === enduroSimulatorId);
    expect(focus?.currentMatchId, '"agora" must never move by itself').toBe('qf-1');
    expect(readTheBugOnAir(stateStore), 'the bug must show the result of the same match').toEqual({
      roundName: 'Quartas de final',
      carAShortName: 'Corisco',
      carBShortName: 'Buffalo',
      winnerCarNumber: 32,
    });
  });

  it('takes the bug\'s fields off the air when the source stops listing the match "agora"', () => {
    // Arrange: qf-2 "agora", the bug on air showing it.
    const { stateStore, refreshTimer } = openStoreWithTheMatchBug();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()]);
    chooseMatchNow(stateStore, 'qf-2');
    takeTheMatchBugBoundToNow(stateStore);

    // Act: the source lists the quarter-finals without qf-2, and the refresher runs.
    const quarterFinals = buildQuarterFinals();
    pollTheSimulatorWithRounds(stateStore, [
      {
        ...quarterFinals,
        matches: quarterFinals.matches.filter((match) => match.matchId !== 'qf-2'),
      },
    ]);
    refreshTimer.runThePendingRefresh();

    // Assert: nothing of qf-2 stays on air, and the focus still names it for the page.
    expect(readTheBugOnAir(stateStore), 'a gone match must leave nothing on air').toEqual({});
    const focus = stateStore
      .readAllSlices()
      .bracketMatchFocuses.find((candidate) => candidate.sourceId === enduroSimulatorId);
    expect(focus?.currentMatchId, 'the page must still be able to name the match').toBe('qf-2');
  });
});
