/**
 * "Salvar como item" of "Edição rápida" (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" makes one-off entries and changes instances; an item is what the
 *   rundown and the shortcut buttons fire again and again. "Salvar como item" turns what
 *   the panel holds (graphic, layer, form) into a new item: it opens the page's item
 *   editor prefilled, and the operator gives the label and "Onde" there. This pure
 *   builder decides what the editor is opened with: where the item goes unless the
 *   operator changes "Onde", and the graphic, layer and fields, each field in the kind
 *   the form shows (a typed value, or "Momento da entrada no ar" for the server).
 *
 * What these tests prove, by the createItem the editor then sends with a label:
 *   - A new entry of the race clock keeps its graphic and layer, stores the typed
 *     values as literals, the reference moment as takeTime, and leaves a blank optional
 *     field out.
 *   - The layer chosen in the panel, not the graphic's default, is the item's layer, and
 *     a moment shown as a typed number is stored as that number.
 *   - The item goes to the rundown on screen, or, when there is none, to the first
 *     shortcut panel in tab order.
 *
 * What these tests deliberately do not cover:
 *   - The editor opening with that prefill and sending createItem:
 *     features/items/ItemEditorPanelPrefill.test.tsx, and the press itself:
 *     QuickEditPanelSaveAsItem.test.tsx.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import type { QuickFirePanel, Rundown } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildCreateItemCommand } from '@/features/items/itemCommandsFromEditor';
import {
  buildEmptySchemaFormValues,
  describeSchemaFormFromDataSchema,
  type SchemaFormValues,
} from '@/features/schemaForm';

import { buildItemSavedFromQuickEdit } from './itemSavedFromQuickEdit';

const description = describeSchemaFormFromDataSchema(raceClockManifest.schema);
// Saturday of the endurance race, 9:45: the moment a loaded clock started counting from.
const momentTheClockWentOnAir = Date.parse('2026-10-10T12:45:00.000Z');

const mainRundown: Rundown = {
  id: 'sessao-principal',
  name: 'Sessão principal',
  sessionLabel: '',
  cursorItemId: null,
};
// Listed out of tab order on purpose: "Atalhos" is the first tab.
const panelsOutOfTabOrder: QuickFirePanel[] = [
  { id: 'painel-box', name: 'Box', order: 1 },
  { id: 'atalhos', name: 'Atalhos', order: 0 },
];

/** A new entry of the race clock for the endurance race: green, running from 0:00. */
function buildFormOfANewEnduranceClock(): SchemaFormValues {
  const formValues = buildEmptySchemaFormValues(description);
  formValues.values.state = 'green';
  formValues.values.running = true;
  return formValues;
}

/** The qualifying clock loaded from the air: its moment shows as the typed number on air. */
function buildFormOfTheLoadedQualifyingClock(): SchemaFormValues {
  const formValues = buildEmptySchemaFormValues(description);
  formValues.values.sessionName = 'Classificação';
  formValues.values.state = 'yellow';
  formValues.values.referenceTimeMs = '10:00';
  formValues.kinds.referenceWallClockMs = 'literal';
  formValues.values.referenceWallClockMs = String(momentTheClockWentOnAir);
  return formValues;
}

const scenarios = [
  // The common case: the operator built a clock by hand and wants it in the rundown.
  {
    name: 'keeps the graphic, the default layer, the typed values and takeTime for the moment',
    formValues: buildFormOfANewEnduranceClock(),
    layerId: 'clock',
    rundowns: [mainRundown],
    expectedCreateItem: {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'race-clock',
      layerId: 'clock',
      label: 'Relógio do enduro',
      color: 'neutral',
      notes: '',
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'green' },
        clockMode: { kind: 'literal', value: 'elapsed' },
        referenceTimeMs: { kind: 'literal', value: 0 },
        referenceWallClockMs: { kind: 'takeTime' },
        running: { kind: 'literal', value: true },
      },
    },
  },
  // A clock loaded from the "Tarja" layer: its layer, and its moment as the number shown.
  {
    name: 'keeps the layer of the panel and a moment shown as a typed number',
    formValues: buildFormOfTheLoadedQualifyingClock(),
    layerId: 'lower-third',
    rundowns: [mainRundown],
    expectedCreateItem: {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'race-clock',
      layerId: 'lower-third',
      label: 'Relógio do enduro',
      color: 'neutral',
      notes: '',
      fields: {
        sessionName: { kind: 'literal', value: 'Classificação' },
        state: { kind: 'literal', value: 'yellow' },
        clockMode: { kind: 'literal', value: 'elapsed' },
        referenceTimeMs: { kind: 'literal', value: 600_000 },
        referenceWallClockMs: { kind: 'literal', value: momentTheClockWentOnAir },
        running: { kind: 'literal', value: false },
      },
    },
  },
  // No rundown on screen (the server sent none): the first shortcut tab is the home.
  {
    name: 'goes to the first shortcut panel in tab order when there is no rundown',
    formValues: buildFormOfANewEnduranceClock(),
    layerId: 'clock',
    rundowns: [],
    expectedCreateItem: expect.objectContaining({
      home: { kind: 'quickFire', panelId: 'atalhos' },
    }),
  },
];

describe('buildItemSavedFromQuickEdit', () => {
  it.each(scenarios)('$name', ({ formValues, layerId, rundowns, expectedCreateItem }) => {
    // Arrange: what the panel holds (the row's data) and what the server lists.
    const quickEditContents = { description, graphicId: 'race-clock', layerId, formValues };

    // Act: build the editor's opening, then the createItem the editor sends once the
    // operator typed the label "Relógio do enduro" and pressed "Salvar item".
    const itemSaved = buildItemSavedFromQuickEdit(quickEditContents, rundowns, panelsOutOfTabOrder);
    const createItem = buildCreateItemCommand({
      home: itemSaved.home,
      itemFormValues: {
        graphicId: itemSaved.prefill.graphicId,
        layerId: itemSaved.prefill.layerId,
        label: 'Relógio do enduro',
        color: 'neutral',
        notes: '',
        autoOutAfterSeconds: '',
      },
      fields: itemSaved.prefill.fields,
    });

    // Assert: the item keeps what the panel held, each field in the kind it showed.
    expect(createItem, 'the new item must store what "Edição rápida" held').toEqual(
      expectedCreateItem,
    );
  });
});
