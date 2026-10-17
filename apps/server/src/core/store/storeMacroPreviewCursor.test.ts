/**
 * The rundown cursor after "Executar" and after macro "Prévia" + "Tomar tudo" (apps/server)
 *
 * What this module is for:
 *   A macro can be carried out two ways. "Executar" (runMacro) has the runner send each
 *   step through the store, so each takeItem moves the cursor by takeItem's rule. Macro
 *   "Prévia" (previewMacro) shows the macro's end state, and "Tomar tudo"
 *   (takeAllPreviews) puts it on air in one instant. João's rule: both must leave the
 *   rundown cursor in the same place, so the operator's plan does not depend on which
 *   button was pressed.
 *
 * What these tests prove (with real stores on temporary SQLite files, and fake timers):
 *   - A macro that takes the cursor item (on the upper layer) and then the next item (on
 *     a lower layer) leaves the cursor on the third item either way. Before
 *     BAJAOVRLAY-36's gate 2, "Tomar tudo" promoted the lower layer first and left the
 *     cursor on the second item, which was already on air.
 *
 * What these tests deliberately do not cover:
 *   - Each cursor rule of takeAllPreviews; takeAllPreviews.test.ts covers them.
 *   - A macro whose takeItem steps go against the rundown's order, or that takes two
 *     items on one layer: there "Executar" judges the cursor step by step while "Tomar
 *     tudo" only sees the end state, so the two can still differ (written next to
 *     takeAllPreviews.ts).
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import { startMacroRunner } from './macroRunner.js';

const operatorActor = 'operador:conexao-7';
const openTheSessionMacroId = 'macro-abrir-sessao';
const mainSessionRundownId = 'sessao-principal';

/** Builds the createItem of a race clock item of the main session on the given layer. */
function buildCreateClockItemOfTheMainSession(label: string, layerId: string, flagState: string) {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: mainSessionRundownId },
    graphicId: 'race-clock',
    layerId,
    label,
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: flagState },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 3_900_000 },
      referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
      running: { kind: 'literal', value: true },
    },
  };
}

/**
 * Builds a store (fake timers, fresh database, a running macro runner) whose main
 * session holds "Relógio grande" on the clock layer (z 30, the cursor item), "Relógio
 * no canto" on the bug layer (z 10) and "Bandeira amarela" on the ticker, and the macro
 * "Abrir a sessão" that takes the first two in rundown order.
 */
function prepareMainSessionAndOpenTheSessionMacro(): StateStore {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const { database } = openTemporaryDatabase();
  const itemIdsInCreationOrder = [
    'item-relogio-grande',
    'item-relogio-no-canto',
    'item-bandeira-amarela',
  ];
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    createItemId: () => itemIdsInCreationOrder.shift() ?? 'item-sem-id',
    createMacroId: () => openTheSessionMacroId,
  });
  store.applyCommand(
    buildCreateClockItemOfTheMainSession('Relógio grande', 'clock', 'green'),
    operatorActor,
  );
  store.applyCommand(
    buildCreateClockItemOfTheMainSession('Relógio no canto', 'bug', 'green'),
    operatorActor,
  );
  store.applyCommand(
    buildCreateClockItemOfTheMainSession('Bandeira amarela', 'ticker', 'yellow'),
    operatorActor,
  );
  store.applyCommand(
    {
      type: 'createMacro',
      label: 'Abrir a sessão',
      color: 'success',
      steps: [
        { kind: 'takeItem', itemId: 'item-relogio-grande' },
        { kind: 'takeItem', itemId: 'item-relogio-no-canto' },
      ],
    },
    operatorActor,
  );
  const runner = startMacroRunner({ stateStore: store, logger: createLogger({ level: 'silent' }) });
  onTestFinished(() => runner.stop());
  return store;
}

/** Reads the main session's cursor item id (null for nothing). */
function readMainSessionCursor(store: StateStore): string | null | undefined {
  const mainSession = store
    .readAllSlices()
    .rundowns.find((rundown) => rundown.id === mainSessionRundownId);
  return mainSession?.cursorItemId;
}

describe('the cursor after a macro, carried out either way', () => {
  it('ends on the same item after "Executar" as after macro "Prévia" and "Tomar tudo"', () => {
    // Arrange: two identical stores, the cursor on "Relógio grande" in both.
    const storeThatExecutes = prepareMainSessionAndOpenTheSessionMacro();
    const storeThatPreviewsAndTakes = prepareMainSessionAndOpenTheSessionMacro();
    const cursorBefore = readMainSessionCursor(storeThatExecutes);

    // Act: press "Executar" on one and let the macro run; press "Prévia" then "Tomar
    // tudo" on the other.
    storeThatExecutes.applyCommand(
      { type: 'runMacro', macroId: openTheSessionMacroId },
      operatorActor,
    );
    vi.advanceTimersByTime(0);
    storeThatPreviewsAndTakes.applyCommand(
      { type: 'previewMacro', macroId: openTheSessionMacroId },
      operatorActor,
    );
    const takeAllOutcome = storeThatPreviewsAndTakes.applyCommand(
      { type: 'takeAllPreviews' },
      operatorActor,
    );

    // Assert: both runs took both items, and both cursors are on "Bandeira amarela".
    expect(cursorBefore, 'the cursor must start on the first item').toBe('item-relogio-grande');
    expect(takeAllOutcome, '"Tomar tudo" must be accepted').toEqual({ ok: true });
    expect(
      readMainSessionCursor(storeThatExecutes),
      '"Executar" must leave the cursor after the two items it took',
    ).toBe('item-bandeira-amarela');
    expect(
      readMainSessionCursor(storeThatPreviewsAndTakes),
      'macro "Prévia" and "Tomar tudo" must leave the cursor where "Executar" leaves it',
    ).toBe(readMainSessionCursor(storeThatExecutes));
  });
});
