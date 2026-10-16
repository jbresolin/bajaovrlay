/**
 * The rundown's "played to its end" mark, once the cursor is placed again (apps/server)
 *
 * What this module is for:
 *   When the last item of a rundown is taken at the cursor, the cursor is left on nothing
 *   and the rundown is marked `wasLastItemTakenAtCursor`, so the control page can say
 *   "Fim do rundown". The mark is only true for as long as that is what happened last:
 *   once the cursor is put on an item again, the rundown is in use again and the mark goes.
 *
 * What these tests prove:
 *   - moveCursor onto an item takes the mark off the rundown.
 *   - moveCursor to nothing on a rundown that was played to its end changes nothing and
 *     hands back the very same slices, so the mark stays and nothing is saved or sent.
 *   - createItem into a rundown that was played to its end and then emptied puts the
 *     cursor on the new item and takes the mark off.
 *
 * What these tests deliberately do not cover:
 *   - Setting the mark; takeItem.test.ts covers it.
 *   - The other rules of moveCursor and createItem; their own test files.
 */
import type { Rundown } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
  mainSessionRundownId,
} from './rundownSlices.testSupport.js';

/** Builds the main session's rundown after its last item was taken at the cursor. */
function buildMainSessionRundownPlayedToItsEnd(): Rundown {
  return { ...buildMainSessionRundown(null), wasLastItemTakenAtCursor: true };
}

describe('a rundown that was played to its end', () => {
  it('loses the mark when moveCursor puts the cursor on an item', () => {
    // Arrange: the main session with two items, played to its end.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundownPlayedToItsEnd()],
      items: [buildEnduroStartItem(0), buildYellowFlagItem(1)],
    });

    // Act: the operator clicks the start item to line it up again.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'moveCursor', rundownId: mainSessionRundownId, itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: the cursor is on the start item and the rundown carries no mark any more.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(outcome.status, 'the cursor must be allowed onto an item of its rundown').toBe(
      'applied',
    );
    expect(
      rundownsAfter?.[0]?.cursorItemId,
      'the cursor must be on the item the operator clicked',
    ).toBe('item-largada-do-enduro');
    expect(
      rundownsAfter?.[0]?.wasLastItemTakenAtCursor ?? false,
      'a rundown whose cursor is on an item is no longer at its end',
    ).toBe(false);
  });

  it('keeps the mark and hands back the very same slices when moveCursor sends null', () => {
    // Arrange: the main session with two items, played to its end; the cursor is on nothing.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundownPlayedToItsEnd()],
      items: [buildEnduroStartItem(0), buildYellowFlagItem(1)],
    });

    // Act: ask for the cursor to be on nothing, which it already is.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'moveCursor', rundownId: mainSessionRundownId, itemId: null },
      contextOfTheRundownCommand,
    );

    // Assert: nothing changed, so the store saves and sends nothing, and the mark stays.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter, 'a cursor already on nothing must hand back the same slices').toBe(
      slicesBefore,
    );
  });

  it('loses the mark when the first item of the emptied rundown is created and gets the cursor', () => {
    // Arrange: the main session played to its end, and every item deleted since.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundownPlayedToItsEnd()],
      items: [],
    });

    // Act: the operator prepares a new item for the next session.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'createItem',
        home: { kind: 'rundown', rundownId: mainSessionRundownId },
        graphicId: 'race-clock',
        layerId: 'clock',
        fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência — Bateria 2' } },
        label: 'Largada da bateria 2',
        color: 'neutral',
        notes: '',
      },
      contextOfTheRundownCommand,
    );

    // Assert: the new item has the cursor and the rundown carries no mark any more.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(
      rundownsAfter?.[0]?.cursorItemId,
      'the first item of an empty rundown must get the cursor',
    ).toBe(contextOfTheRundownCommand.newItemId);
    expect(
      rundownsAfter?.[0]?.wasLastItemTakenAtCursor ?? false,
      'a rundown whose cursor is on its new item is no longer at its end',
    ).toBe(false);
  });
});
