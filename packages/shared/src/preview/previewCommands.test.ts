/**
 * The six preview commands: previewItem, stopPreview, takePreview, previewClearLayer,
 * takeAllPreviews, previewMacro (packages/shared)
 *
 * What this module is for:
 *   Nothing goes to air without being seen first, and Prévia shows exactly what the
 *   screen will look like after the take. The operator puts an item (`previewItem`) on
 *   the preview output of its layer, or marks a layer "will be cleared"
 *   (`previewClearLayer`), or previews the end state of a macro (`previewMacro`); then either sends one layer (`takePreview`) or everything at once
 *   (`takeAllPreviews`) to the program output, or throws it away (`stopPreview`, for one
 *   layer or for all of them). These schemas say what each command must look like before
 *   the server looks at its state.
 *
 * What these tests prove:
 *   - Each command is accepted in its real shape. (previewGraphic, the preview of
 *     hand-typed data, left the list in BAJAOVRLAY-37; ../commands/command.test.ts proves
 *     it is refused.)
 *   - previewItem says who asked for the preview in `origin`: 'manual' (a button or
 *     Shift+Space; filled in when left out) or 'auto' ("Prévia automática" following the
 *     cursor). Any other word is refused.
 *   - stopPreview says "every layer" with `layerId: null`, written out; a layer that
 *     happens to be called "all" is still one layer.
 *   - previewClearLayer names one layer, takeAllPreviews names nothing, previewMacro names
 *     one macro.
 *   - A command with a part missing or empty is refused, and the failure names the part.
 *   - The error codes the server answers when nothing is previewed on a layer
 *     (LAYER_PREVIEW_EMPTY) and when "Tomar tudo" has nothing to take
 *     (NOTHING_IN_PREVIEW) are part of the closed list of codes.
 *
 * What these tests deliberately do not cover:
 *   - Whether the item or layer exists, and what each command does to the
 *     state; the reducers in apps/server check those.
 *   - The `takeTimeFieldKeys` and the `previewOrigin` an instance on the preview output
 *     remembers; those are fields of the instance, covered in ../slices/instance.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';
import { CommandErrorSchema } from '../commands/commandError.js';

const yellowFlagItemId = 'b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10';

describe('the preview commands in their real shape', () => {
  const acceptedPreviewCommandScenarios = [
    // The "Prévia" button of a rundown row: a client that says nothing about the origin
    // asked by hand, so an older client can never discard previews by accident.
    {
      name: 'accepts previewItem for one item and fills in the origin manual',
      command: { type: 'previewItem', itemId: yellowFlagItemId },
      expectedAfterValidation: {
        type: 'previewItem',
        itemId: yellowFlagItemId,
        origin: 'manual',
      },
    },
    // Shift+Space, written out in full.
    {
      name: 'accepts previewItem that says it was asked for by hand',
      command: { type: 'previewItem', itemId: yellowFlagItemId, origin: 'manual' },
      expectedAfterValidation: {
        type: 'previewItem',
        itemId: yellowFlagItemId,
        origin: 'manual',
      },
    },
    // "Prévia automática": the cursor arrived on a row and the page previews it by itself.
    {
      name: 'accepts previewItem that says it was made by Prévia automática',
      command: { type: 'previewItem', itemId: yellowFlagItemId, origin: 'auto' },
      expectedAfterValidation: { type: 'previewItem', itemId: yellowFlagItemId, origin: 'auto' },
    },
    // "Descartar" under the Prévia monitor: the preview of one layer goes away.
    {
      name: 'accepts stopPreview for one layer',
      command: { type: 'stopPreview', layerId: 'lower-third' },
      expectedAfterValidation: { type: 'stopPreview', layerId: 'lower-third' },
    },
    // Every preview at once is said with null, never with a word a layer could be called.
    {
      name: 'accepts stopPreview for every layer, written as layerId null',
      command: { type: 'stopPreview', layerId: null },
      expectedAfterValidation: { type: 'stopPreview', layerId: null },
    },
    // A layer may be named anything, "all" included; it is then one layer like any other.
    {
      name: 'accepts stopPreview for a layer whose id is the word all, as one layer',
      command: { type: 'stopPreview', layerId: 'all' },
      expectedAfterValidation: { type: 'stopPreview', layerId: 'all' },
    },
    // "Tomar" under the Prévia monitor: what is previewed on that layer goes on air.
    {
      name: 'accepts takePreview for one layer',
      command: { type: 'takePreview', layerId: 'clock' },
      expectedAfterValidation: { type: 'takePreview', layerId: 'clock' },
    },
    // "Prévia: limpar" on a Camadas row: the Prévia shows that layer empty, as it will be.
    {
      name: 'accepts previewClearLayer for one layer',
      command: { type: 'previewClearLayer', layerId: 'lower-third' },
      expectedAfterValidation: { type: 'previewClearLayer', layerId: 'lower-third' },
    },
    // "Tomar tudo" names nothing: it takes every preview and applies every marker.
    {
      name: 'accepts takeAllPreviews with nothing else in it',
      command: { type: 'takeAllPreviews' },
      expectedAfterValidation: { type: 'takeAllPreviews' },
    },
    // A macro's "Prévia" in its ⋯ menu.
    {
      name: 'accepts previewMacro for one macro',
      command: { type: 'previewMacro', macroId: 'macro-abrir-sessao' },
      expectedAfterValidation: { type: 'previewMacro', macroId: 'macro-abrir-sessao' },
    },
  ];

  it.each(acceptedPreviewCommandScenarios)('$name', ({ command, expectedAfterValidation }) => {
    // Arrange: the command as the control page sends it (from the table above).
    const commandFromControlPage = command;

    // Act: check the command.
    const result = CommandSchema.safeParse(commandFromControlPage);

    // Assert: it is accepted, with only the parts the row says filled in.
    expect(result.success, 'a preview command in its real shape must be accepted').toBe(true);
    expect(result.data, 'the command must come out as the row says').toEqual(
      expectedAfterValidation,
    );
  });
});

describe('the preview commands with a part missing', () => {
  const refusedPreviewCommandScenarios = [
    // A preview of nothing is refused before it reaches the state.
    {
      name: 'refuses a previewItem with an empty item id, naming itemId',
      command: { type: 'previewItem', itemId: '' },
      fieldNamedInTheFailure: 'itemId',
    },
    // The origin decides whether other previews are discarded, so a word the server does
    // not know must not be read as either of the two.
    {
      name: 'refuses a previewItem with an origin that is neither auto nor manual, naming origin',
      command: { type: 'previewItem', itemId: yellowFlagItemId, origin: 'automatica' },
      fieldNamedInTheFailure: 'origin',
    },
    // "Every layer" must be said with null; a missing layer is more likely a bug, and a
    // bug must not throw every preview away.
    {
      name: 'refuses a stopPreview that leaves the layer out, naming layerId',
      command: { type: 'stopPreview' },
      fieldNamedInTheFailure: 'layerId',
    },
    // An empty text is neither a layer nor "every layer".
    {
      name: 'refuses a stopPreview with an empty layer id, naming layerId',
      command: { type: 'stopPreview', layerId: '' },
      fieldNamedInTheFailure: 'layerId',
    },
    // takePreview promotes one layer; every layer at once is takeAllPreviews, its own
    // command, so a lost layer id can never take every preview to air.
    {
      name: 'refuses a takePreview for every layer, naming layerId',
      command: { type: 'takePreview', layerId: null },
      fieldNamedInTheFailure: 'layerId',
    },
    // "Prévia: limpar" is always for one layer; there is no "mark every layer" in one go.
    {
      name: 'refuses a previewClearLayer that leaves the layer out, naming layerId',
      command: { type: 'previewClearLayer' },
      fieldNamedInTheFailure: 'layerId',
    },
    // An empty text names no layer.
    {
      name: 'refuses a previewClearLayer with an empty layer id, naming layerId',
      command: { type: 'previewClearLayer', layerId: '' },
      fieldNamedInTheFailure: 'layerId',
    },
    // A macro's "Prévia" must say which macro.
    {
      name: 'refuses a previewMacro without a macro id, naming macroId',
      command: { type: 'previewMacro' },
      fieldNamedInTheFailure: 'macroId',
    },
  ];

  it.each(refusedPreviewCommandScenarios)('$name', ({ command, fieldNamedInTheFailure }) => {
    // Arrange: the incomplete command from the table above.
    const incompleteCommand = command;

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(incompleteCommand);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the bad part.
    expect(result.success, 'an incomplete preview command must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain(fieldNamedInTheFailure);
  });
});

describe('CommandErrorSchema and the preview error code', () => {
  it('accepts LAYER_PREVIEW_EMPTY with its pt-BR message', () => {
    // Arrange: the error the server answers a takePreview with when nothing is previewed.
    const errorFromTheServer = {
      code: 'LAYER_PREVIEW_EMPTY',
      message: 'Não há nada em prévia na camada "Relógio" para colocar no ar.',
    };

    // Act: check it against the schema.
    const result = CommandErrorSchema.safeParse(errorFromTheServer);

    // Assert: it is accepted unchanged, so the control page can show it.
    expect(result.success, 'the preview error code must be part of the closed list').toBe(true);
    expect(result.data, 'the accepted error must not be altered').toEqual(errorFromTheServer);
  });

  it('accepts NOTHING_IN_PREVIEW with its pt-BR message', () => {
    // Arrange: the error the server answers "Tomar tudo" with when there is nothing to take.
    const errorFromTheServer = {
      code: 'NOTHING_IN_PREVIEW',
      message:
        'Não há nada em prévia para colocar no ar: nenhuma camada tem prévia nem está marcada para limpar.',
    };

    // Act: check it against the schema.
    const result = CommandErrorSchema.safeParse(errorFromTheServer);

    // Assert: it is accepted unchanged, so the control page can show it.
    expect(result.success, 'the new error code must be part of the closed list').toBe(true);
    expect(result.data, 'the accepted error must not be altered').toEqual(errorFromTheServer);
  });
});
