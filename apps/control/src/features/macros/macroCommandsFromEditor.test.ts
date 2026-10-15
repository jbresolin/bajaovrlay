/**
 * The commands the macro editor sends (apps/control)
 *
 * What this module is for:
 *   "Salvar macro" sends createMacro for a new macro and updateMacro for a stored one.
 *   macroCommandsFromEditor.ts builds them from the editor's label, colour and steps (the
 *   steps already built by macroStepDrafts.ts). An update carries only the parts that
 *   differ from the macro as it was when the editor opened, as the item editor does, so
 *   two operators changing different parts of one macro both keep their change.
 *
 * What these tests prove:
 *   - A new macro is sent whole, its label trimmed.
 *   - An update carries only the label, the colour or the steps that changed; the steps
 *     always as the whole new list (updateMacro replaces them).
 *   - With nothing changed there is no command at all.
 *
 * What these tests deliberately do not cover:
 *   - The checks on the label and the rows before anything is built:
 *     macroStepDrafts.test.ts and MacroEditorPanel.test.tsx.
 */
import type { Macro } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildCreateMacroCommand, buildUpdateMacroCommand } from './macroCommandsFromEditor';

/** "Abrir a sessão" as the server stores it: the clock, then the bug. */
function buildOpenTheSessionMacro(): Macro {
  return {
    id: 'macro-abrir-sessao',
    label: 'Abrir a sessão',
    color: 'success',
    steps: [
      { kind: 'takeItem', itemId: 'item-relogio-enduro' },
      { kind: 'takeItem', itemId: 'item-logo-baja' },
    ],
  };
}

describe('buildCreateMacroCommand', () => {
  it('sends the whole new macro, its label trimmed', () => {
    // Arrange: what the editor holds for a new macro.
    const editorValues = {
      label: '  Abrir a sessão ',
      color: 'success' as const,
      steps: buildOpenTheSessionMacro().steps,
    };

    // Act: build the command.
    const command = buildCreateMacroCommand(editorValues);

    // Assert: exactly what the server expects.
    expect(command, 'a new macro must be sent whole').toEqual({
      type: 'createMacro',
      label: 'Abrir a sessão',
      color: 'success',
      steps: [
        { kind: 'takeItem', itemId: 'item-relogio-enduro' },
        { kind: 'takeItem', itemId: 'item-logo-baja' },
      ],
    });
  });
});

describe('buildUpdateMacroCommand', () => {
  const scenarios = [
    // Renaming only: the steps another operator may be changing are left alone.
    {
      name: 'carries only the label when only the label changed',
      label: 'Abrir a bateria',
      color: 'success' as const,
      steps: buildOpenTheSessionMacro().steps,
      expected: { type: 'updateMacro', macroId: 'macro-abrir-sessao', label: 'Abrir a bateria' },
    },
    // A colour change is sent alone too.
    {
      name: 'carries only the colour when only the colour changed',
      label: 'Abrir a sessão',
      color: 'info' as const,
      steps: buildOpenTheSessionMacro().steps,
      expected: { type: 'updateMacro', macroId: 'macro-abrir-sessao', color: 'info' },
    },
    // Swapping two steps is a change of the steps, sent as the whole new list.
    {
      name: 'carries the whole new list when the steps changed',
      label: 'Abrir a sessão',
      color: 'success' as const,
      steps: [
        { kind: 'takeItem' as const, itemId: 'item-logo-baja' },
        { kind: 'takeItem' as const, itemId: 'item-relogio-enduro' },
      ],
      expected: {
        type: 'updateMacro',
        macroId: 'macro-abrir-sessao',
        steps: [
          { kind: 'takeItem', itemId: 'item-logo-baja' },
          { kind: 'takeItem', itemId: 'item-relogio-enduro' },
        ],
      },
    },
    // Spaces around an unchanged label are not a change.
    {
      name: 'sends nothing when nothing changed',
      label: ' Abrir a sessão ',
      color: 'success' as const,
      steps: buildOpenTheSessionMacro().steps,
      expected: undefined,
    },
  ];

  it.each(scenarios)('$name', ({ label, color, steps, expected }) => {
    // Arrange: the stored macro, as the editor opened it.
    const macroAsOpened = buildOpenTheSessionMacro();

    // Act: build the update from the editor's values.
    const command = buildUpdateMacroCommand({ macroAsOpened, label, color, steps });

    // Assert: only what changed, or nothing.
    expect(command, 'the update must carry exactly the parts that changed').toEqual(expected);
  });
});
