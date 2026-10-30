/**
 * Rundowns, items and field values (packages/shared)
 *
 * What this module is for:
 *   An item is a prepared use of a graphic: which graphic, on which layer, with a value
 *   for each field, plus what the operator needs to recognise it (label, colour, notes).
 *   A rundown is the ordered list of items of one session, with a cursor on the item
 *   that goes on air next. Both are slices the server owns (`rundowns` and `items`), and
 *   an instance on air remembers the item it came from in `itemId`.
 *
 * What these tests prove:
 *   - A rundown is accepted with its cursor on an item or on nothing (null), and the
 *     cursor must always be written, never left out.
 *   - A prepared race-clock item is accepted unchanged, with or without an auto-out.
 *   - An item is refused, with the field named, when its colour is not one of the six
 *     fixed names, when a field names a team in the first draft shape of an entity
 *     reference (entityId, not the car number of BAJAOVRLAY-19), when a literal has no
 *     value, when its order is negative or its auto-out is zero.
 *   - The six item colours are exactly the names the control page maps to its tokens.
 *   - The state as a whole now needs the `rundowns` and `items` slices, and a `slice`
 *     message named `items` must carry items.
 *
 * What these tests deliberately do not cover:
 *   - Whether an item's rundown, graphic or layer exists, or whether the orders of a
 *     rundown's items have no gaps; that needs the whole state, so the reducers in
 *     apps/server check it.
 *   - Whether the field values fit the graphic's own schema; the server checks that at
 *     the take.
 *   - The item id an instance remembers; slices/instance.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SliceNameSchema, SlicesSchema } from '../slices/slices.js';
import { SliceMessageSchema } from '../ws/serverMessages.js';
import { ItemSchema } from './item.js';
import { ItemColorSchema } from './itemColor.js';
import { RundownSchema } from './rundown.js';

/** Builds the one rundown the server seeds, with its cursor on the enduro clock item. */
function buildMainSessionRundown() {
  return {
    id: 'sessao-principal',
    name: 'Sessão principal',
    sessionLabel: 'Enduro de Resistência — domingo',
    cursorItemId: 'b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10',
  };
}

/** Builds the item an operator prepares to put the enduro clock on air under green. */
function buildEnduroClockItem() {
  return {
    id: 'b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      referenceTimeMs: { kind: 'literal', value: 14_400_000 },
      running: { kind: 'literal', value: true },
    },
    label: 'Relógio do enduro — largada',
    color: 'success',
    notes: 'Colocar no ar quando o diretor de prova der a bandeira verde.',
  };
}

/** Builds the whole state of a race morning: one rundown, one prepared item, nothing on air. */
function buildRaceMorningStateWithOnePreparedItem() {
  return {
    outputs: [{ outputId: 'program', name: 'Programa', order: 0 }],
    layers: [
      {
        id: 'clock',
        outputId: 'program',
        name: 'Relógio',
        zIndex: 30,
        replacePolicy: 'out-then-in',
        persistent: true,
      },
    ],
    graphics: [
      {
        id: 'race-clock',
        manifest: { id: 'baja-race-clock', name: 'Relógio de prova', main: 'race-clock.js' },
        defaultLayerId: 'clock',
        category: 'clock',
        thumbnailUrl: null,
        defaultFields: {},
      },
    ],
    instances: [],
    previewClearedLayerIds: [],
    instanceBindings: [],
    overrides: [],
    rundowns: [buildMainSessionRundown()],
    items: [buildEnduroClockItem()],
    // The seeded panel, no macro and nothing running: quickFirePanels.test.ts and
    // macros.test.ts cover those slices.
    quickFirePanels: [{ id: 'atalhos', name: 'Atalhos', order: 0 }],
    macros: [],
    macroRuns: [],
    dataSources: [],
    dataSnapshots: [],
    recordings: [],
    events: [],
    eventRules: [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
    eventLog: [],
  };
}

describe('RundownSchema', () => {
  const acceptedRundownScenarios = [
    // The usual case during a session: the cursor points at the item that goes next.
    {
      name: 'accepts a rundown whose cursor is on an item',
      cursorItemId: 'b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10',
    },
    // A rundown right after the first boot, or after its last item was taken: no next item.
    { name: 'accepts a rundown whose cursor is on nothing', cursorItemId: null },
  ];

  it.each(acceptedRundownScenarios)('$name', ({ cursorItemId }) => {
    // Arrange: the main session's rundown with the cursor from the table above.
    const rundown = { ...buildMainSessionRundown(), cursorItemId };

    // Act: check it against the schema.
    const result = RundownSchema.safeParse(rundown);

    // Assert: it is accepted and comes back exactly as written.
    expect(result.success, 'a rundown with a cursor or a null cursor must be accepted').toBe(true);
    expect(result.data, 'the accepted rundown must not be altered').toEqual(rundown);
  });

  it('refuses a rundown that leaves the cursor out, naming cursorItemId', () => {
    // Arrange: a rundown written without any cursor field at all.
    const rundownWithoutCursorField = {
      id: 'sessao-principal',
      name: 'Sessão principal',
      sessionLabel: 'Enduro de Resistência — domingo',
    };

    // Act: check it and turn the failure into readable text.
    const result = RundownSchema.safeParse(rundownWithoutCursorField);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused, because "no next item" must be said with null, not by silence.
    expect(result.success, 'a rundown must always say where its cursor is').toBe(false);
    expect(failureMessage, 'the failure must name the missing field').toContain('cursorItemId');
  });
});

describe('ItemSchema', () => {
  it('accepts a prepared race-clock item unchanged', () => {
    // Arrange: the enduro clock item as the item editor saves it, with no auto-out.
    const enduroClockItem = buildEnduroClockItem();

    // Act: check it against the schema.
    const result = ItemSchema.safeParse(enduroClockItem);

    // Assert: it is accepted and comes back exactly as written.
    expect(result.success, 'a complete item with literal fields must be accepted').toBe(true);
    expect(result.data, 'the accepted item must not be altered').toEqual(enduroClockItem);
  });

  it('accepts an item that takes itself off air after eight seconds', () => {
    // Arrange: a sponsor card meant to leave the screen by itself after 8 s.
    const sponsorCardItem = {
      ...buildEnduroClockItem(),
      label: 'Patrocinador — oferecimento',
      autoOutAfterMs: 8_000,
    };

    // Act: check it against the schema.
    const result = ItemSchema.safeParse(sponsorCardItem);

    // Assert: it is accepted and the delay is kept in milliseconds.
    expect(result.success, 'an item with an auto-out delay must be accepted').toBe(true);
    expect(result.data?.autoOutAfterMs, 'the auto-out delay must be kept as written').toBe(8_000);
  });

  const refusedItemScenarios = [
    // A hex value would bypass the control page's design tokens; only the six names exist.
    {
      name: 'refuses a colour written as a hex value, naming color',
      changedPart: { color: '#ff0000' },
      fieldNamedInTheFailure: 'color',
    },
    // The concept's first draft of an entity reference said entityId; as built by
    // BAJAOVRLAY-19 a team is chosen by its car number, so a stored draft is refused.
    {
      name: 'refuses a team reference in the first draft shape, naming carNumber',
      changedPart: {
        fields: {
          sessionName: { kind: 'entity', entityType: 'team', entityId: '42', attribute: 'name' },
        },
      },
      fieldNamedInTheFailure: 'carNumber',
    },
    // A literal with nothing in it would reach the graphic as a missing field.
    {
      name: 'refuses a literal field that has no value, naming value',
      changedPart: { fields: { sessionName: { kind: 'literal' } } },
      fieldNamedInTheFailure: 'value',
    },
    // Order is a position in the list, counted from 0; a negative one means a bug upstream.
    {
      name: 'refuses a negative order, naming order',
      changedPart: { order: -1 },
      fieldNamedInTheFailure: 'order',
    },
    // "No auto-out" is said by leaving the field out; zero would clear the layer at once.
    {
      name: 'refuses an auto-out of zero milliseconds, naming autoOutAfterMs',
      changedPart: { autoOutAfterMs: 0 },
      fieldNamedInTheFailure: 'autoOutAfterMs',
    },
  ];

  it.each(refusedItemScenarios)('$name', ({ changedPart, fieldNamedInTheFailure }) => {
    // Arrange: the enduro clock item with one part replaced by the bad one from the table.
    const itemWithOneBadPart = { ...buildEnduroClockItem(), ...changedPart };

    // Act: check it and turn the failure into readable text.
    const result = ItemSchema.safeParse(itemWithOneBadPart);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the bad field.
    expect(result.success, 'an item with a bad part must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain(fieldNamedInTheFailure);
  });
});

describe('ItemColorSchema', () => {
  it('offers exactly the six colour names the control page maps to its tokens', () => {
    // Arrange: the six names agreed with the control page, in the order its picker shows.
    const sixAgreedColorNames = ['neutral', 'info', 'success', 'warning', 'danger', 'highlight'];

    // Act: read the choices the schema allows.
    const colorNamesTheSchemaAllows = ItemColorSchema.options;

    // Assert: they are those six and no other, so the picker never offers an unmapped one.
    expect(colorNamesTheSchemaAllows, 'the item colours must be the six agreed names').toEqual(
      sixAgreedColorNames,
    );
  });
});

describe('the rundowns and items slices in the whole state', () => {
  it('accepts a race morning state with one rundown and one prepared item, unchanged', () => {
    // Arrange: the state after the operator prepared the enduro clock before the session.
    const raceMorningState = buildRaceMorningStateWithOnePreparedItem();

    // Act: check it against the schema of every slice.
    const result = SlicesSchema.safeParse(raceMorningState);

    // Assert: it is accepted and comes back exactly as written.
    expect(result.success, 'a state with a rundown and an item must be accepted').toBe(true);
    expect(result.data, 'the accepted state must not be altered').toEqual(raceMorningState);
  });

  it('refuses a state that has no items slice, naming items', () => {
    // Arrange: the same state as an older server would send it, without the items slice.
    const { items: itemsLeftOut, ...stateWithoutItems } =
      buildRaceMorningStateWithOnePreparedItem();

    // Act: check it and turn the failure into readable text.
    const result = SlicesSchema.safeParse(stateWithoutItems);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused, so a page never shows an empty rundown by mistake.
    expect(itemsLeftOut, 'the item taken out of the state is the prepared one').toHaveLength(1);
    expect(result.success, 'a state without the items slice must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the missing slice').toContain('items');
  });

  it('lists rundowns and items among the slice names', () => {
    // Arrange: the two slice names this task adds.
    const sliceNamesAddedForRundowns = ['rundowns', 'items'];

    // Act: read every slice name the schema allows.
    const everySliceName = SliceNameSchema.options;

    // Assert: both are there, so the server can announce a change to either.
    expect(everySliceName, 'rundowns and items must be slice names').toEqual(
      expect.arrayContaining(sliceNamesAddedForRundowns),
    );
  });
});

describe('SliceMessageSchema for rundowns and items', () => {
  it('accepts an items slice message carrying the prepared item', () => {
    // Arrange: what the server sends to every page after the operator saves an item.
    const itemsSliceMessage = { type: 'slice', name: 'items', slice: [buildEnduroClockItem()] };

    // Act: check it against the schema.
    const result = SliceMessageSchema.safeParse(itemsSliceMessage);

    // Assert: it is accepted unchanged.
    expect(result.success, 'an items slice message must be accepted').toBe(true);
    expect(result.data, 'the accepted message must not be altered').toEqual(itemsSliceMessage);
  });

  it('accepts a rundowns slice message carrying the main session', () => {
    // Arrange: what the server sends to every page after the cursor moves.
    const rundownsSliceMessage = {
      type: 'slice',
      name: 'rundowns',
      slice: [buildMainSessionRundown()],
    };

    // Act: check it against the schema.
    const result = SliceMessageSchema.safeParse(rundownsSliceMessage);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a rundowns slice message must be accepted').toBe(true);
    expect(result.data, 'the accepted message must not be altered').toEqual(rundownsSliceMessage);
  });

  it('refuses a message named items that carries a rundown instead', () => {
    // Arrange: a server bug that puts the rundowns under the name of the items slice.
    const rundownsSentAsItems = {
      type: 'slice',
      name: 'items',
      slice: [buildMainSessionRundown()],
    };

    // Act: check it against the schema.
    const result = SliceMessageSchema.safeParse(rundownsSentAsItems);

    // Assert: it is refused, so a page can never store rundowns as items.
    expect(result.success, 'the name must decide what the slice contains').toBe(false);
  });
});
