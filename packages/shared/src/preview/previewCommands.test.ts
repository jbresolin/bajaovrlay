/**
 * The four preview commands: previewItem, previewGraphic, stopPreview, takePreview
 * (packages/shared)
 *
 * What this module is for:
 *   Nothing goes to air without being seen first. The operator puts an item
 *   (`previewItem`) or hand-typed data (`previewGraphic`) on the preview output of a
 *   layer, looks at it, and then either sends exactly that to the program output
 *   (`takePreview`) or throws it away (`stopPreview`, for one layer or for all of them).
 *   These schemas say what each command must look like before the server looks at its
 *   state.
 *
 * What these tests prove:
 *   - Each command is accepted in its real shape. previewGraphic gets an empty
 *     `takeTimeFieldKeys` list when it names no field for the server to stamp, and carries
 *     no `target`: it always goes to the preview output.
 *   - stopPreview says "every layer" with `layerId: null`, written out; a layer that
 *     happens to be called "all" is still one layer.
 *   - A command with a part missing or empty is refused, and the failure names the part.
 *   - The error code the server answers when nothing is previewed on a layer,
 *     LAYER_PREVIEW_EMPTY, is part of the closed list of codes.
 *
 * What these tests deliberately do not cover:
 *   - Whether the item, graphic or layer exists, and what each command does to the
 *     state; the reducers in apps/server check those.
 *   - The `takeTimeFieldKeys` an instance on the preview output remembers; that is a field
 *     of the instance, covered in ../slices/instance.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';
import { CommandErrorSchema } from '../commands/commandError.js';

const yellowFlagItemId = 'b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10';

describe('the preview commands in their real shape', () => {
  const acceptedPreviewCommandScenarios = [
    // The "Prévia" button of a rundown row, and the cursor arriving on a row.
    {
      name: 'accepts previewItem for one item',
      command: { type: 'previewItem', itemId: yellowFlagItemId },
      expectedAfterValidation: { type: 'previewItem', itemId: yellowFlagItemId },
    },
    // The "Prévia" button of "Edição rápida", with every field typed by the operator.
    {
      name: 'accepts previewGraphic and fills in an empty stamp list',
      command: {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: { sessionName: 'Enduro de Resistência', state: 'yellow' },
      },
      expectedAfterValidation: {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: { sessionName: 'Enduro de Resistência', state: 'yellow' },
        takeTimeFieldKeys: [],
      },
    },
    // A clock previewed from "Edição rápida" leaves its reference moment to the server,
    // exactly as a takeGraphic does, and may carry a cleared field as null.
    {
      name: 'accepts previewGraphic naming a field the server stamps and a cleared field',
      command: {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: { sessionName: 'Enduro de Resistência', lapsCompletedByLeader: null },
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
      expectedAfterValidation: {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: { sessionName: 'Enduro de Resistência', lapsCompletedByLeader: null },
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
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
  ];

  it.each(acceptedPreviewCommandScenarios)('$name', ({ command, expectedAfterValidation }) => {
    // Arrange: the command as the control page sends it (from the table above).
    const commandFromControlPage = command;

    // Act: check the command.
    const result = CommandSchema.safeParse(commandFromControlPage);

    // Assert: it is accepted, with only the stamp list of previewGraphic filled in.
    expect(result.success, 'a preview command in its real shape must be accepted').toBe(true);
    expect(result.data, 'the command must come out as the row says').toEqual(
      expectedAfterValidation,
    );
  });

  it('does not let a previewGraphic choose its output', () => {
    // Arrange: a previewGraphic that asks for the program output, as a confused client might.
    const previewAskingForProgram = {
      type: 'previewGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: { sessionName: 'Enduro de Resistência' },
      target: 'program',
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(previewAskingForProgram);

    // Assert: it is accepted, but the `target` is gone: a preview can never go on air.
    expect(result.success, 'the command itself is well formed').toBe(true);
    expect(result.data, 'a previewGraphic must not carry a target after validation').toEqual({
      type: 'previewGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: { sessionName: 'Enduro de Resistência' },
      takeTimeFieldKeys: [],
    });
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
    // A graphic is previewed on a layer, so the command must say which.
    {
      name: 'refuses a previewGraphic without a layer, naming layerId',
      command: { type: 'previewGraphic', graphicId: 'race-clock', data: {} },
      fieldNamedInTheFailure: 'layerId',
    },
    // An empty key names no field: a form that lost a field name must not pass silently.
    {
      name: 'refuses a previewGraphic whose stamp list holds an empty key',
      command: {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: {},
        takeTimeFieldKeys: [''],
      },
      fieldNamedInTheFailure: 'takeTimeFieldKeys',
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
    // Only one layer is promoted at a time; there is no "take every preview".
    {
      name: 'refuses a takePreview for every layer, naming layerId',
      command: { type: 'takePreview', layerId: null },
      fieldNamedInTheFailure: 'layerId',
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
});
