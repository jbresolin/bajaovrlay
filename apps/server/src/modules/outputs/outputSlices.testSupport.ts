// Test support for the outputs module: a race day with the program output and João's PiP
// output (the scene with the camera box), each with its own layers. Every builder returns
// new objects; nothing here keeps state between calls.
import {
  type Instance,
  type Item,
  type Layer,
  type Macro,
  type Output,
  sortLayersBottomToTop,
} from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from '../../core/store/reducers/reducerTypes.js';
import { buildRaceDaySlicesWithRundown } from '../../core/store/reducers/rundownSlices.testSupport.js';

/** The program output, as every database has it. */
export function buildProgramOutput(): Output {
  return { outputId: 'program', name: 'Programa', order: 0 };
}

/** The PiP output: the browser source of the OBS scene with the camera box. */
export function buildPipOutput(): Output {
  return { outputId: 'pip', name: 'PiP', order: 1 };
}

/** The PiP's frame around the camera box, at the bottom of its output. */
export function buildPipFrameLayer(): Layer {
  return {
    id: 'moldura-pip',
    outputId: 'pip',
    name: 'Moldura',
    zIndex: 10,
    replacePolicy: 'cut',
    persistent: true,
  };
}

/** The PiP's caption with live data, above the frame. */
export function buildPipCaptionLayer(): Layer {
  return {
    id: 'legenda-pip',
    outputId: 'pip',
    name: 'Legenda',
    zIndex: 20,
    replacePolicy: 'out-then-in',
    persistent: false,
  };
}

/** "Legenda PiP — Baja UFPR": team 42's lower third, prepared for the PiP's caption. */
export function buildPipCaptionItem(order: number): Item {
  return {
    id: 'item-legenda-pip-baja-ufpr',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order,
    graphicId: 'team-lower-third',
    layerId: 'legenda-pip',
    fields: {
      teamNumber: { kind: 'literal', value: 42 },
      teamName: { kind: 'literal', value: 'Baja UFPR' },
    },
    label: 'Legenda PiP — Baja UFPR',
    color: 'info',
    notes: '',
  };
}

/** Team 42's caption on air on the PiP, as a take leaves it once the renderer reported. */
export function buildPipCaptionOnAir(): Instance {
  return {
    id: '5b0e8d3c-71a2-4f69-9c1e-2a7d4b6f8e03',
    layerId: 'legenda-pip',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-25T14:00:00.000Z',
    itemId: 'item-legenda-pip-baja-ufpr',
  };
}

/** "Fechar PiP": the macro that clears the PiP's caption. */
export function buildCloseThePipMacro(): Macro {
  return {
    id: 'macro-fechar-pip',
    label: 'Fechar PiP',
    color: 'neutral',
    steps: [{ kind: 'clearLayer', layerId: 'legenda-pip' }],
  };
}

/**
 * A race day with program (the seven seeded layers) and PiP (frame and caption), the
 * race clock and team lower third registered, and whatever items, instances, markers and
 * macros a test gives.
 */
export function buildRaceDaySlicesWithPip(parts: {
  items?: Item[];
  instances?: Instance[];
  previewClearedLayerIds?: string[];
  macros?: Macro[];
}): SlicesChangedByCommands {
  const slicesOfProgramAlone = buildRaceDaySlicesWithRundown({
    items: parts.items ?? [],
    instances: parts.instances ?? [],
    previewClearedLayerIds: parts.previewClearedLayerIds ?? [],
    macros: parts.macros ?? [],
  });
  return {
    ...slicesOfProgramAlone,
    outputs: [buildProgramOutput(), buildPipOutput()],
    layers: sortLayersBottomToTop([
      ...slicesOfProgramAlone.layers,
      buildPipFrameLayer(),
      buildPipCaptionLayer(),
    ]),
  };
}

/** The ids and outputs of the layers, bottom to top as the slice holds them. */
export function readLayerIdsWithTheirOutput(layers: Layer[]): string[] {
  return layers.map((layer) => `${layer.id}@${layer.outputId}:${String(layer.zIndex)}`);
}
