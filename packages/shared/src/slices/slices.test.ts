/**
 * State slices (packages/shared)
 *
 * What this module is for:
 *   The server owns all state as thirteen named slices: `layers` (where graphics can go),
 *   `graphics` (what can be shown), `instances` (what is showing now),
 *   `previewClearedLayerIds` (the layers Prévia shows empty because a take will clear
 *   them), `rundowns` and `items` (the planned show), `quickFirePanels` (the grids of
 *   buttons), `macros` and `macroRuns` (one-press sequences and the one running now),
 *   `dataSources`, `dataSnapshots` and `recordings` (the race data feeds, their last good
 *   data and the recorded feeds) and `eventLog` (the commands that changed something or
 *   were refused, in order). SlicesSchema describes all thirteen; the server checks what
 *   it stores and sends against it, and the control page and renderer check what they
 *   receive.
 *
 * What these tests prove:
 *   - A realistic race-day state (five layers, the race clock registered and on air,
 *     one logged command) is accepted unchanged.
 *   - A layer with a replace policy the renderer does not know is refused, and the
 *     failure names the field.
 *   - An instance in a status outside the lifecycle is refused.
 *   - An instance may be `failed` and carry the reason the renderer gave
 *     (`statusDetail`), and that reason must be a text.
 *   - A failed event-log entry must carry the error a person reads.
 *   - quickFirePanels, macros, macroRuns, previewClearedLayerIds, dataSources,
 *     dataSnapshots and recordings are required like every other slice, the thirteen
 *     slice names come in the server's order, and a slice
 *     message's name decides what it carries for the new slices too.
 *   - A "will be cleared" marker is a layer id: a list of texts, none of them empty.
 *
 * What these tests deliberately do not cover:
 *   - How the server changes slices; the reducer and store tests in apps/server do.
 *   - Every field of every schema; Zod's own behaviour is not re-tested here.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SliceMessageSchema } from '../ws/serverMessages.js';
import { SliceNameSchema, SlicesSchema } from './slices.js';

/** Builds the state of a race day morning: five layers, the clock registered and on air. */
function buildRaceDayStateWithTheClockOnAir() {
  return {
    layers: [
      { id: 'bug', name: 'Logo', zIndex: 10, replacePolicy: 'out-then-in', persistent: true },
      { id: 'clock', name: 'Relógio', zIndex: 30, replacePolicy: 'out-then-in', persistent: true },
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
    instances: [
      {
        id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
        currentStep: 0,
        status: 'loading',
        takenAt: '2026-10-09T13:00:00.000Z',
      },
    ],
    // The operator pressed "Prévia: limpar" on the logo: Prévia shows it gone.
    previewClearedLayerIds: ['bug'],
    instanceBindings: [],
    overrides: [],
    eventLog: [
      {
        id: 1,
        ts: '2026-10-09T13:00:00.000Z',
        actor: 'operador:conexao-1',
        command: 'takeGraphic',
        payload: { type: 'takeGraphic', graphicId: 'race-clock', layerId: 'clock' },
        result: { status: 'ok' },
      },
    ],
    // No rundown and no prepared item: rundownAndItemSlices.test.ts covers those slices.
    rundowns: [],
    items: [],
    // The seeded panel "Atalhos", one macro, and that macro running at its first step.
    quickFirePanels: [{ id: 'atalhos', name: 'Atalhos', order: 0 }],
    macros: [
      {
        id: 'macro-abrir-sessao',
        label: 'Abrir a sessão',
        color: 'success',
        steps: [{ kind: 'clearLayer', layerId: 'clock' }],
      },
    ],
    macroRuns: [
      {
        macroId: 'macro-abrir-sessao',
        startedAt: '2026-10-09T13:00:05.000Z',
        currentStep: 0,
        isStopRequested: false,
      },
    ],
    // No data source, snapshot or recording: dataSources.test.ts covers those slices.
    dataSources: [],
    dataSnapshots: [],
    recordings: [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
  };
}

describe('SlicesSchema', () => {
  it('accepts a race day state with the clock on air, unchanged', () => {
    // Arrange: the state the server holds after the operator takes the race clock.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();

    // Act: check it against the schema.
    const result = SlicesSchema.safeParse(raceDayState);

    // Assert: it is accepted and comes back exactly as sent.
    expect(result.success, 'a realistic state must be accepted').toBe(true);
    expect(result.data, 'the accepted state must not be altered').toEqual(raceDayState);
  });

  it('refuses a layer whose replace policy the renderer does not know, naming the field', () => {
    // Arrange: the same state, with a made-up replace policy on the clock layer.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithUnknownPolicy = {
      ...raceDayState,
      layers: [{ ...raceDayState.layers[1], replacePolicy: 'dissolve' }],
    };

    // Act: check it and turn the failure into readable text.
    const result = SlicesSchema.safeParse(stateWithUnknownPolicy);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at replacePolicy.
    expect(result.success, 'an unknown replace policy must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain('replacePolicy');
  });

  it('refuses an instance in a status outside the lifecycle', () => {
    // Arrange: the clock instance claims a status that does not exist.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithUnknownStatus = {
      ...raceDayState,
      instances: [{ ...raceDayState.instances[0], status: 'paused' }],
    };

    // Act: check it against the schema.
    const result = SlicesSchema.safeParse(stateWithUnknownStatus);

    // Assert: it is refused.
    expect(result.success, 'only loading, ready, on-air, stopping and failed are statuses').toBe(
      false,
    );
  });

  it('accepts a failed instance that carries the reason the renderer gave', () => {
    // Arrange: the renderer reported that the clock could not be loaded, and why.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithFailedClock = {
      ...raceDayState,
      instances: [
        {
          ...raceDayState.instances[0],
          status: 'failed',
          statusDetail:
            'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js',
        },
      ],
    };

    // Act: check it against the schema.
    const result = SlicesSchema.safeParse(stateWithFailedClock);

    // Assert: it is accepted, and the reason is still there for the layer panel to show.
    expect(result.success, 'failed must be a status an instance can be in').toBe(true);
    expect(result.data, 'the reason for the failure must be kept').toEqual(stateWithFailedClock);
  });

  it('refuses an instance whose status detail is not a text, naming the field', () => {
    // Arrange: the failed clock carries an error object instead of words a person reads.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithUnreadableDetail = {
      ...raceDayState,
      instances: [
        { ...raceDayState.instances[0], status: 'failed', statusDetail: { statusCode: 500 } },
      ],
    };

    // Act: check it and turn the failure into readable text.
    const result = SlicesSchema.safeParse(stateWithUnreadableDetail);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at statusDetail.
    expect(result.success, 'the status detail must be a text').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain('statusDetail');
  });

  it('refuses a failed event-log entry that does not say why it failed', () => {
    // Arrange: a failed command logged without the error the operator would read.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithSilentFailure = {
      ...raceDayState,
      eventLog: [{ ...raceDayState.eventLog[0], result: { status: 'failed' } }],
    };

    // Act: check it against the schema.
    const result = SlicesSchema.safeParse(stateWithSilentFailure);

    // Assert: it is refused, because a failure without a reason cannot be audited.
    expect(result.success, 'a failed entry must carry its error').toBe(false);
  });

  const missingSliceScenarios = [
    // An older server without quick-fire panels: a page must not draw an empty strip.
    { name: 'refuses a state without the quickFirePanels slice', sliceLeftOut: 'quickFirePanels' },
    // Without macros the "Macros" tab would claim there are none.
    { name: 'refuses a state without the macros slice', sliceLeftOut: 'macros' },
    // Without the runs a running macro's button would look idle.
    { name: 'refuses a state without the macroRuns slice', sliceLeftOut: 'macroRuns' },
    // Without the sources the "Fontes" page would claim there are none.
    { name: 'refuses a state without the dataSources slice', sliceLeftOut: 'dataSources' },
    // Without the snapshots the source detail would show no data at all.
    { name: 'refuses a state without the dataSnapshots slice', sliceLeftOut: 'dataSnapshots' },
    // Without the recordings the replay form would have nothing to offer.
    { name: 'refuses a state without the recordings slice', sliceLeftOut: 'recordings' },
    // Without the markers the Prévia monitor would show a layer on air that will be cleared.
    {
      name: 'refuses a state without the previewClearedLayerIds slice',
      sliceLeftOut: 'previewClearedLayerIds',
    },
  ];

  it.each(missingSliceScenarios)('$name', ({ sliceLeftOut }) => {
    // Arrange: the race day state with this row's slice taken out.
    const stateWithoutTheSlice: Record<string, unknown> = {
      ...buildRaceDayStateWithTheClockOnAir(),
    };
    delete stateWithoutTheSlice[sliceLeftOut];

    // Act: check it and turn the failure into readable text.
    const result = SlicesSchema.safeParse(stateWithoutTheSlice);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the missing slice.
    expect(result.success, 'every slice is required, the new ones included').toBe(false);
    expect(failureMessage, 'the failure must name the missing slice').toContain(sliceLeftOut);
  });
});

describe('SliceNameSchema', () => {
  it('lists every slice in the order the server lists them, the newest ones included', () => {
    // Arrange: the slice names; the "will be cleared" markers and the bindings of each
    // instance right after the instances they speak about, quick-fire panels and macros
    // after the items, and the data sources, their snapshots, the operator's corrections
    // of them and the recordings, then the entity library (teams, people, sponsors and the
    // schedule), just before the event log.
    const expectedSliceNames = [
      'layers',
      'graphics',
      'instances',
      'previewClearedLayerIds',
      'instanceBindings',
      'rundowns',
      'items',
      'quickFirePanels',
      'macros',
      'macroRuns',
      'dataSources',
      'dataSnapshots',
      'overrides',
      'recordings',
      'teams',
      'people',
      'sponsors',
      'scheduleSlots',
      'eventLog',
    ];

    // Act: read every slice name the schema allows.
    const everySliceName = SliceNameSchema.options;

    // Assert: exactly these, in this order.
    expect(everySliceName, 'the slice names must be these nineteen, in this order').toEqual(
      expectedSliceNames,
    );
  });
});

describe('SliceMessageSchema for the quick-fire panels and macros', () => {
  it('accepts a macroRuns slice message with no run, the end of every run', () => {
    // Arrange: what every page gets when a macro has finished.
    const noRunMessage = { type: 'slice', name: 'macroRuns', slice: [] };

    // Act: check it against the schema.
    const result = SliceMessageSchema.safeParse(noRunMessage);

    // Assert: accepted unchanged.
    expect(result.success, 'an empty macroRuns slice message must be accepted').toBe(true);
    expect(result.data, 'the accepted message must not be altered').toEqual(noRunMessage);
  });

  it('refuses a message named quickFirePanels that carries a macro instead', () => {
    // Arrange: a server bug that sends the macros under the panels' name.
    const macrosSentAsPanels = {
      type: 'slice',
      name: 'quickFirePanels',
      slice: buildRaceDayStateWithTheClockOnAir().macros,
    };

    // Act: check it against the schema.
    const result = SliceMessageSchema.safeParse(macrosSentAsPanels);

    // Assert: refused, so a page never stores macros as panels.
    expect(result.success, 'the name must decide what the slice contains').toBe(false);
  });
});

describe('SliceMessageSchema for the "will be cleared" markers', () => {
  it('accepts a previewClearedLayerIds slice message naming two layers, unchanged', () => {
    // Arrange: what every page gets after "Prévia: limpar" on the logo and the lower third.
    const markersMessage = {
      type: 'slice',
      name: 'previewClearedLayerIds',
      slice: ['bug', 'lower-third'],
      serverNowMs: 1_791_556_325_000,
    };

    // Act: check it against the schema.
    const result = SliceMessageSchema.safeParse(markersMessage);

    // Assert: accepted unchanged, so the preview page can leave those layers empty.
    expect(result.success, 'a markers slice message must be accepted').toBe(true);
    expect(result.data, 'the accepted message must not be altered').toEqual(markersMessage);
  });

  it('refuses a marker that is an empty text, naming the slice', () => {
    // Arrange: a server bug that marks a layer without an id.
    const stateWithAnEmptyMarker = {
      ...buildRaceDayStateWithTheClockOnAir(),
      previewClearedLayerIds: [''],
    };

    // Act: check it and turn the failure into readable text.
    const result = SlicesSchema.safeParse(stateWithAnEmptyMarker);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the markers slice.
    expect(result.success, 'a marker must name a layer').toBe(false);
    expect(failureMessage, 'the failure must name the markers slice').toContain(
      'previewClearedLayerIds',
    );
  });
});
