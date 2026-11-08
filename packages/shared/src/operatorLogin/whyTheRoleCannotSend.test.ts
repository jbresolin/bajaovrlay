/**
 * Why the Dados role cannot send a command, in pt-BR (packages/shared)
 *
 * What this module is for:
 *   When Dados (BAJAOVRLAY-29) sends a command only the Produtor may send, the server
 *   refuses it with one sentence starting "O papel Dados não pode …", and the control page
 *   shows the same sentence in the tooltip of the greyed-out button. One function words it
 *   for both, from the command's group in the history page's filter.
 *
 * What these tests prove:
 *   - A take or a clear says it changes what is on air; a preview, the preview; anything
 *     else the Produtor alone may do (pausing triggers, moving the cursor) says so plainly.
 *   - Every sentence starts "O papel Dados não pode" and ends asking for the Produtor.
 *
 * What these tests deliberately do not cover:
 *   - Which commands Dados may send; commandSenders.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { describeWhyTheDataRoleCannotSend } from './whyTheRoleCannotSend.js';

const sentenceScenarios = [
  // "Tomar" of an item: on air.
  {
    name: 'a take changes what is on air',
    commandType: 'takeItem' as const,
    expected: 'O papel Dados não pode mudar o que está no ar. Peça ao Produtor.',
  },
  // "Desfazer última" changes program too.
  {
    name: 'an undo changes what is on air',
    commandType: 'undoLastChangeOnProgram' as const,
    expected: 'O papel Dados não pode mudar o que está no ar. Peça ao Produtor.',
  },
  // "Prévia" of an item: the preview output.
  {
    name: 'a preview changes the preview',
    commandType: 'previewItem' as const,
    expected: 'O papel Dados não pode mudar a prévia. Peça ao Produtor.',
  },
  // "Pausar gatilhos" is neither, and still the producer's.
  {
    name: 'pausing the triggers is the producer’s',
    commandType: 'setTriggersPaused' as const,
    expected: 'O papel Dados não pode fazer isso: é com o Produtor.',
  },
];

describe('describeWhyTheDataRoleCannotSend', () => {
  it.each(sentenceScenarios)('$name', ({ commandType, expected }) => {
    // Arrange: the command type of the row (in the table above).

    // Act: word the refusal.
    const sentence = describeWhyTheDataRoleCannotSend(commandType);

    // Assert: the row's sentence.
    expect(sentence, 'the refusal the operator reads').toBe(expected);
  });
});
