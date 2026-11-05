// Test support: slices that read like what the real server sends, so every test starts
// from the same believable state. Each function builds new objects on every call, so
// no test can change what another test sees.
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import {
  type Graphic,
  type Instance,
  type Layer,
  obsSliceWithoutObs,
  type Slices,
} from '@bajaovrlay/shared';

/** The six layers the server seeds on its first boot, bottom to top. */
export function buildLayersSeededByTheServer(): Layer[] {
  return [
    {
      id: 'bug',
      outputId: 'program',
      name: 'Logo',
      zIndex: 10,
      replacePolicy: 'out-then-in',
      persistent: true,
    },
    {
      id: 'ticker',
      outputId: 'program',
      name: 'Letreiro',
      zIndex: 20,
      replacePolicy: 'out-then-in',
      persistent: false,
    },
    {
      id: 'clock',
      outputId: 'program',
      name: 'Relógio',
      zIndex: 30,
      replacePolicy: 'out-then-in',
      persistent: true,
    },
    {
      id: 'tower',
      outputId: 'program',
      name: 'Torre',
      zIndex: 35,
      replacePolicy: 'out-then-in',
      persistent: true,
    },
    {
      id: 'lower-third',
      outputId: 'program',
      name: 'Tarja',
      zIndex: 40,
      replacePolicy: 'out-then-in',
      persistent: false,
    },
    {
      id: 'fullscreen',
      outputId: 'program',
      name: 'Tela cheia',
      zIndex: 50,
      replacePolicy: 'out-then-in',
      persistent: false,
    },
  ];
}

/**
 * The race clock as the server registers it once its package is built: the graphic
 * carries the package's whole manifest, data schema included, because the control page
 * generates the graphic's form from that schema. The manifest is the real one
 * (packages/graphics/race-clock), copied on every call.
 */
export function buildRaceClockGraphic(): Graphic {
  return {
    id: 'race-clock',
    manifest: structuredClone(raceClockManifest),
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The race clock on air on the clock layer, showing the endurance race under green. */
export function buildRaceClockInstanceOnTheClockLayer(takenAt: string): Instance {
  return {
    id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(takenAt),
      running: true,
    },
    currentStep: 0,
    status: 'loading',
    takenAt,
  };
}

/** What the server sends right after boot: its layers, the race clock, nothing on air. */
export function buildSlicesWithNothingOnAir(): Slices {
  return {
    outputs: [{ outputId: 'program', name: 'Programa', order: 0 }],
    layers: buildLayersSeededByTheServer(),
    graphics: [buildRaceClockGraphic()],
    instances: [],
    // No layer is marked "vai limpar": the server keeps the marks in memory only.
    previewClearedLayerIds: [],
    eventLog: [],
    // The one rundown the server seeds on its first boot, still empty. Tests that need
    // items in it use rundownLikeTheServerSends.testSupport.ts.
    rundowns: [
      { id: 'sessao-principal', name: 'Sessão principal', sessionLabel: '', cursorItemId: null },
    ],
    items: [],
    // The one quick-fire panel the server seeds, "Atalhos", still empty; no macros and
    // nothing running. Tests that need buttons use quickFireLikeTheServerSends.testSupport.ts.
    quickFirePanels: [{ id: 'atalhos', name: 'Atalhos', order: 0 }],
    macros: [],
    macroRuns: [],
    macroStops: [],
    obs: obsSliceWithoutObs,
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
    instanceBindings: [],
    programHistory: [],
    overrides: [],
  };
}

/** The same state with the race clock on air on the clock layer since `takenAt`. */
export function buildSlicesWithTheRaceClockOnAir(takenAt: string): Slices {
  return {
    ...buildSlicesWithNothingOnAir(),
    instances: [buildRaceClockInstanceOnTheClockLayer(takenAt)],
  };
}
