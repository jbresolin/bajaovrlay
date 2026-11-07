/**
 * A take step's fields filled from the trigger, as rows and as steps (apps/control)
 *
 * What this module is for:
 *   In the macro editor a "Pôr item no ar" step can fill any field of its item from "Dado
 *   do gatilho › <chave>" (BAJAOVRLAY-48). The step offers the fields of the item's
 *   graphic, by title, saying which are required; the row keeps the key typed for each
 *   field chosen; the step sent is `{ kind: 'takeItem', itemId, triggerFields }`, and a
 *   step with no such field is sent exactly as before.
 *
 * What these tests prove:
 *   - The fields offered are the graphic's, in its order, with titles and the required ones.
 *   - A row with keys becomes a step with triggerFields; a row without, a plain take.
 *   - A blank key, or one past 64 characters, is the row's problem, in pt-BR.
 *   - A stored step's trigger fields come back as the row's keys.
 *
 * What these tests deliberately do not cover:
 *   - The controls on the page; MacroEditorPanelTriggerData.test.tsx.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  buildEmptyMacroStepDraft,
  buildMacroStepDraftsFromSteps,
  buildMacroStepsFromDrafts,
} from './macroStepDrafts';
import { listGraphicFieldsOfEachItem } from './takeStepTriggerFields';

/** "Relógio do enduro", a race clock item, as the strip's fixtures have it. */
function buildEnduroClockItem(): Item {
  return {
    id: 'item-relogio-enduro',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    label: 'Relógio do enduro',
    color: 'info',
    notes: '',
    fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência' } },
  };
}

describe('listGraphicFieldsOfEachItem', () => {
  it('offers the graphic’s fields in its order, by title, marking the required ones', () => {
    // Arrange: the clock item and the race clock graphic.
    const items = [buildEnduroClockItem()];

    // Act: list its fields.
    const fieldsOfEachItem = listGraphicFieldsOfEachItem(items, [buildRaceClockGraphic()]);

    // Assert: the first two, "Título" required, as the manifest lists them.
    expect(
      fieldsOfEachItem['item-relogio-enduro']?.slice(0, 2),
      'the fields must be the graphic’s, with their titles',
    ).toEqual([
      { fieldKey: 'sessionName', title: 'Título', isRequired: true },
      { fieldKey: 'state', title: 'Bandeira', isRequired: true },
    ]);
  });
});

describe('a take row with fields from the trigger', () => {
  const rowsAndTheirSteps: Array<{
    name: string;
    keys: Record<string, string>;
    expected: unknown;
  }> = [
    // The plain take, as every macro before BAJAOVRLAY-48 has it.
    {
      name: 'a row with no key is a plain take',
      keys: {},
      expected: { isValid: true, steps: [{ kind: 'takeItem', itemId: 'item-relogio-enduro' }] },
    },
    // The session's name from a schedule trigger's `sessao`.
    {
      name: 'a row with a key fills that field from the trigger',
      keys: { sessionName: 'sessao' },
      expected: {
        isValid: true,
        steps: [
          {
            kind: 'takeItem',
            itemId: 'item-relogio-enduro',
            triggerFields: { sessionName: { kind: 'triggerData', key: 'sessao' } },
          },
        ],
      },
    },
    // "Dado do gatilho" chosen but nothing typed: nothing could fill the field.
    {
      name: 'a blank key is the row’s problem',
      keys: { sessionName: '  ' },
      expected: {
        isValid: false,
        errorMessageByDraftId: {
          'passo-1': 'Escreva a chave de cada campo que vem do gatilho (de 1 a 64 caracteres).',
        },
      },
    },
    // The server keeps keys to 64 characters.
    {
      name: 'a key past 64 characters is the row’s problem',
      keys: { sessionName: 'k'.repeat(65) },
      expected: {
        isValid: false,
        errorMessageByDraftId: {
          'passo-1': 'Escreva a chave de cada campo que vem do gatilho (de 1 a 64 caracteres).',
        },
      },
    },
  ];

  it.each(rowsAndTheirSteps)('$name', ({ keys, expected }) => {
    // Arrange: a take row of the clock with this row's keys.
    const draft = {
      ...buildEmptyMacroStepDraft('passo-1', 'takeItem'),
      itemId: 'item-relogio-enduro',
      triggerKeyByFieldKey: keys,
    };

    // Act: build the steps.
    const result = buildMacroStepsFromDrafts([draft]);

    // Assert: the step, or the row's problem.
    expect(result, 'the row must become this step or this problem').toEqual(expected);
  });

  it('brings a stored step’s trigger fields back as the row’s keys', () => {
    // Arrange: a stored take filling the title from `sessao`.
    const storedStep = {
      kind: 'takeItem' as const,
      itemId: 'item-relogio-enduro',
      triggerFields: { sessionName: { kind: 'triggerData' as const, key: 'sessao' } },
    };

    // Act: open it in the editor.
    const [draft] = buildMacroStepDraftsFromSteps([storedStep], () => 'passo-1');

    // Assert: the key is in the row.
    expect(draft?.triggerKeyByFieldKey, 'the row must show the key the step reads').toEqual({
      sessionName: 'sessao',
    });
  });
});
