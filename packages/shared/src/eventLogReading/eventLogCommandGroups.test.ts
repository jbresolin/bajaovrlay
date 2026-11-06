/**
 * The command groups of the history filter (packages/shared)
 *
 * What this module is for:
 *   The history page (BAJAOVRLAY-30) filters rows by what kind of command they are:
 *   "Tomadas e limpezas", "Prévias", "Itens e rundown", "Fontes e dados" and
 *   "Configurações". Every command type is classed once, in a Record the compiler checks.
 *
 * What these tests prove:
 *   - The commands an operator would look for under each group are there, the
 *     borderline ones included (a take of a preview is a take; an edit on air is a change
 *     on air; dismissing an event is data).
 *   - Each group has its pt-BR label.
 *
 * What these tests deliberately do not cover:
 *   - That every command type is classed; sentenceOfEachCommandType.test.ts checks the
 *     groups against CommandSchema beside the sentences.
 */
import { describe, expect, it } from 'vitest';

import {
  commandGroupOfEachCommandType,
  eventLogCommandGroupLabels,
} from './eventLogCommandGroups.js';

const groupScenarios = [
  // The brief's own examples: takes and clears.
  { name: 'a take is a take', commandType: 'takeItem', expected: 'takesAndClears' },
  { name: '"Limpar tudo" is a clear', commandType: 'clearAll', expected: 'takesAndClears' },
  // "Tomar" under Prévia puts the preview on air, whatever its name says.
  { name: 'taking a preview is a take', commandType: 'takePreview', expected: 'takesAndClears' },
  // An undo changes what is on air.
  {
    name: '"Desfazer última" is with the takes',
    commandType: 'undoLastChangeOnProgram',
    expected: 'takesAndClears',
  },
  // An edit on air changes what the viewers see.
  {
    name: 'an edit on air is with the takes',
    commandType: 'updateInstanceData',
    expected: 'takesAndClears',
  },
  // A preview by itself changes nothing on air.
  { name: 'a preview is a preview', commandType: 'previewItem', expected: 'previews' },
  // Preparing the show.
  {
    name: 'editing an item is item work',
    commandType: 'updateItemFields',
    expected: 'itemsAndRundown',
  },
  {
    name: 'moving the cursor is rundown work',
    commandType: 'moveCursor',
    expected: 'itemsAndRundown',
  },
  // The data the show reads.
  { name: 'a correction is data', commandType: 'setOverride', expected: 'sourcesAndData' },
  // Only showEvent puts an event on air; the inbox's bookkeeping is data.
  { name: 'dismissing an event is data', commandType: 'dismissEvent', expected: 'sourcesAndData' },
  // The setup.
  { name: 'editing a layer is a setting', commandType: 'updateLayer', expected: 'settings' },
  // OBS connecting or dropping is the setup's health.
  {
    name: 'OBS’s connection state is a setting',
    commandType: 'recordObsState',
    expected: 'settings',
  },
] as const;

describe('commandGroupOfEachCommandType', () => {
  it.each(groupScenarios)('$name', ({ commandType, expected }) => {
    // Arrange: the command type (in the table above).

    // Act: read its group.
    const group = commandGroupOfEachCommandType[commandType];

    // Assert: the group an operator would look under.
    expect(group, 'the command must be in the group an operator looks under').toBe(expected);
  });
});

describe('eventLogCommandGroupLabels', () => {
  it('names every group in pt-BR', () => {
    // Arrange: nothing beyond the labels themselves.

    // Act: read them in the filter's order.
    const labels = Object.values(eventLogCommandGroupLabels);

    // Assert: the five groups, in pt-BR.
    expect(labels, 'the filter must offer the five groups in pt-BR').toEqual([
      'Tomadas e limpezas',
      'Prévias',
      'Itens e rundown',
      'Fontes e dados',
      'Configurações',
    ]);
  });
});
