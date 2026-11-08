// The graphics, items and instances the "item mudou" table test is built from: the
// interview lower third, the sponsor roll and the endurance clock, as an editor saves them
// and as a take puts them on air. Used by itemAheadOfTheAir.test.ts.
import type { Graphic } from '../slices/graphic.js';
import type { Instance } from '../slices/instance.js';
import type { ItemFields } from './fieldValue.js';
import type { Item } from './item.js';

const momentOfTheTake = '2026-10-10T13:00:00.000Z';
export const momentOfTheTakeInMilliseconds = Date.parse(momentOfTheTake);

/** The interview lower third: name, role and team typed, the car read from the timing source. */
export function buildInterviewLowerThirdGraphic(): Graphic {
  return {
    id: 'lower-third',
    manifest: {
      id: 'baja-lower-third',
      name: 'Tarja',
      main: 'lower-third.js',
      schema: {
        type: 'object',
        properties: {
          nome: { type: 'string', title: 'Nome' },
          funcao: { type: 'string', title: 'Função' },
          equipe: { type: 'string', title: 'Equipe' },
          posicao: { type: 'integer', title: 'Posição' },
        },
        required: ['nome'],
      },
    },
    defaultLayerId: 'lower-third',
    category: 'lower-third',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The sponsor roll, which reads every sponsor of the library as one list. */
export function buildSponsorRollGraphic(): Graphic {
  return {
    id: 'sponsor-roll',
    manifest: {
      id: 'baja-sponsor-roll',
      name: 'Patrocinadores',
      main: 'sponsor-roll.js',
      schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', title: 'Título' },
          patrocinadores: { type: 'array', title: 'Patrocinadores', items: { type: 'object' } },
        },
        required: ['patrocinadores'],
      },
    },
    defaultLayerId: 'fullscreen',
    category: 'sponsors',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** An item of this graphic with these fields, as the editor saves it. */
export function buildItemOfGraphic(graphic: Graphic, fields: ItemFields): Item {
  return {
    id: `item-${graphic.id}`,
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: graphic.id,
    layerId: graphic.defaultLayerId,
    fields,
    label: `${graphic.manifest.name} do enduro`,
    color: 'info',
    notes: '',
  };
}

/** The instance on program that a take of this item made, showing this data. */
export function buildInstanceOnProgramShowing(
  item: Item,
  resolvedData: Record<string, unknown>,
  fieldsChangedOnAir?: string[],
): Instance {
  const instance: Instance = {
    id: `instance-of-${item.id}`,
    layerId: item.layerId,
    graphicId: item.graphicId,
    target: 'program',
    resolvedData,
    currentStep: 0,
    status: 'on-air',
    takenAt: momentOfTheTake,
    itemId: item.id,
  };
  if (fieldsChangedOnAir !== undefined) {
    instance.fieldsChangedOnAir = fieldsChangedOnAir;
  }
  return instance;
}

/** Ana Souza, captain of Baja UFPR, as the item says now; her position read live. */
export function buildAnaSouzaFields(): ItemFields {
  return {
    nome: { kind: 'literal', value: 'Ana Souza' },
    funcao: { kind: 'literal', value: 'Capitã' },
    equipe: { kind: 'literal', value: 'Baja UFPR' },
    posicao: {
      kind: 'binding',
      sourceId: 'cronometragem',
      shapeKey: 'positions',
      path: 'position',
      carNumber: 42,
      isLive: true,
    },
  };
}

/** Ana Souza's fields as saved after the take under this name, the role taken out of the item. */
export function buildAnaSouzaFieldsSavedWithoutARole(name: string): ItemFields {
  const fields: ItemFields = { ...buildAnaSouzaFields(), nome: { kind: 'literal', value: name } };
  delete fields.funcao;
  return fields;
}

/** The endurance clock item: 240:00 counting down, stopped, its moment stamped at the take. */
export function buildEnduranceClockFields(): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'remaining' },
    referenceTimeMs: { kind: 'literal', value: 14_400_000 },
    referenceWallClockMs: { kind: 'takeTime' },
    running: { kind: 'literal', value: false },
  };
}

/** The endurance clock as its take put it on air. */
export function buildEnduranceClockAsTaken(): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'remaining',
    referenceTimeMs: 14_400_000,
    referenceWallClockMs: momentOfTheTakeInMilliseconds,
    running: false,
  };
}
