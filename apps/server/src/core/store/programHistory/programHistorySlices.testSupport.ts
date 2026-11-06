// Test support: a race day for the tests of undo on program (BAJAOVRLAY-30). Two lower
// thirds of people, a notice and the race clock, each a quick-fire button, and a helper
// that runs commands one after the other as the store would, each with its own instance id
// and a second later than the one before. Every function builds fresh objects on each call.
import { type CommandInput, CommandSchema, type Item, type Layer } from '@bajaovrlay/shared';

import { reduceCommand } from '../reducers/reduceCommand.js';
import type { ReducerContext, SlicesChangedByCommands } from '../reducers/reducerTypes.js';
import {
  buildEnduroClockFields,
  buildRaceDaySlicesWithRundown,
  contextOfTheRundownCommand,
  shortcutsPanelId,
} from '../reducers/rundownSlices.testSupport.js';

/** The moment of the first command of a scenario: 14:32:05 UTC on 9 October 2026. */
const momentOfTheFirstCommandMs = Date.parse('2026-10-09T14:32:05.000Z');

/** Builds a lower third of a person on the "Tarja" layer, a button of "Atalhos". */
function buildPersonLowerThirdItem(parts: {
  id: string;
  order: number;
  personName: string;
  personRole: string;
}): Item {
  return {
    id: parts.id,
    home: { kind: 'quickFire', panelId: shortcutsPanelId },
    order: parts.order,
    graphicId: 'team-lower-third',
    layerId: 'lower-third',
    fields: {
      personName: { kind: 'literal', value: parts.personName },
      personRole: { kind: 'literal', value: parts.personRole },
    },
    label: `Tarja – ${parts.personName}`,
    color: 'info',
    notes: '',
  };
}

/** "Tarja – Ana Souza": the right lower third, the team 42 driver being interviewed. */
export function buildAnaSouzaLowerThirdItem(): Item {
  return buildPersonLowerThirdItem({
    id: 'item-tarja-ana-souza',
    order: 0,
    personName: 'Ana Souza',
    personRole: 'Piloto · Baja UFPR, carro 42',
  });
}

/** "Tarja – Bruno Lima": the wrong lower third, a button away from the right one. */
export function buildBrunoLimaLowerThirdItem(): Item {
  return buildPersonLowerThirdItem({
    id: 'item-tarja-bruno-lima',
    order: 1,
    personName: 'Bruno Lima',
    personRole: 'Capitão · Mangue Baja, carro 7',
  });
}

/** "Aviso – Melhor volta": a notice on the "Aviso" layer, gone by itself after 8 s. */
export function buildFastestLapNoticeItem(): Item {
  return {
    id: 'item-aviso-melhor-volta',
    home: { kind: 'quickFire', panelId: shortcutsPanelId },
    order: 2,
    graphicId: 'team-lower-third',
    layerId: 'notice',
    fields: {
      personName: { kind: 'literal', value: 'Melhor volta: carro 31' },
      personRole: { kind: 'literal', value: '1:42.318 · Acauã Baja' },
    },
    autoOutAfterMs: 8_000,
    label: 'Aviso – Melhor volta',
    color: 'warning',
    notes: '',
  };
}

/** "Relógio – Enduro": the race clock under green flag, every field typed. */
export function buildEnduroClockItem(): Item {
  return {
    id: 'item-relogio-enduro',
    home: { kind: 'quickFire', panelId: shortcutsPanelId },
    order: 3,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: buildEnduroClockFields('green'),
    label: 'Relógio – Enduro',
    color: 'success',
    notes: '',
  };
}

/** The race day with the four items above as buttons of "Atalhos", nothing on air. */
export function buildRaceDayWithTheFourButtons(): SlicesChangedByCommands {
  return buildRaceDaySlicesWithRundown({
    items: [
      buildAnaSouzaLowerThirdItem(),
      buildBrunoLimaLowerThirdItem(),
      buildFastestLapNoticeItem(),
      buildEnduroClockItem(),
    ],
  });
}

/** The "PiP" output's one layer, "Câmera do box", where the team's own lower third goes. */
export function buildPitCameraLayer(): Layer {
  return {
    id: 'camera-do-box',
    outputId: 'pip',
    name: 'Câmera do box',
    zIndex: 10,
    replacePolicy: 'cut',
    persistent: false,
  };
}

/** The context the store hands the reducer for the n-th command of a scenario (from 1). */
export function buildContextOfCommandNumber(commandNumber: number): ReducerContext {
  return {
    ...contextOfTheRundownCommand,
    newInstanceId: `instancia-${String(commandNumber)}`,
    now: new Date(momentOfTheFirstCommandMs + (commandNumber - 1) * 1_000).toISOString(),
  };
}

/**
 * Runs the commands one after the other through reduceCommand, numbering them from
 * `firstCommandNumber` (1 unless given), and hands back the slices after the last one.
 * Each is checked by CommandSchema first, as the store does, so its defaults are filled.
 * A refused command fails the test at once with its pt-BR reason.
 */
export function applyCommandsOneAfterTheOther(
  slices: SlicesChangedByCommands,
  commands: CommandInput[],
  firstCommandNumber = 1,
): SlicesChangedByCommands {
  let slicesSoFar = slices;
  commands.forEach((command, index) => {
    const context = buildContextOfCommandNumber(firstCommandNumber + index);
    const outcome = reduceCommand(slicesSoFar, CommandSchema.parse(command), context);
    if (outcome.status === 'refused') {
      throw new Error(`${command.type} was refused: ${outcome.error.message}`);
    }
    slicesSoFar = outcome.slices;
  });
  return slicesSoFar;
}

/** The item id and data on a layer's program output, or undefined when it shows nothing. */
export function readWhatProgramShowsOnLayer(
  slices: SlicesChangedByCommands,
  layerId: string,
): { itemId: string | undefined; resolvedData: Record<string, unknown> } | undefined {
  const instanceOnProgram = slices.instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
  if (instanceOnProgram === undefined) {
    return undefined;
  }
  return { itemId: instanceOnProgram.itemId, resolvedData: instanceOnProgram.resolvedData };
}

/** How many changes a layer remembers in the programHistory slice. */
export function countChangesRememberedOnLayer(
  slices: SlicesChangedByCommands,
  layerId: string,
): number {
  const layerHistory = slices.programHistory.find((history) => history.layerId === layerId);
  return layerHistory?.entries.length ?? 0;
}
