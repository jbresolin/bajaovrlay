/**
 * Commands (packages/shared)
 *
 * What this module is for:
 *   A command is the only way state changes. CommandSchema lists every command the
 *   server accepts, told apart by their `type` field. Since BAJAOVRLAY-37 everything on
 *   air or in preview comes from an item, so the two commands that put a graphic up by
 *   hand, `takeGraphic` and `previewGraphic`, are not in the list any more: an item is
 *   taken with takeItem or previewed with previewItem. The commands added since M0 each
 *   have a test file of their own next to their schema.
 *
 * What these tests prove:
 *   - takeGraphic and previewGraphic are refused in every shape they used to have, naming
 *     `type`, so no page and no Companion button can put a graphic up without an item.
 *   - clearLayer and clearAll are accepted in their real shape, clearLayer also aimed at
 *     program (the auto-out's clear); a clearLayer aimed at preview is refused, naming
 *     `target`, because stopPreview is the command for emptying a preview.
 *   - A command type the server does not know is refused, naming `type`.
 *
 * What these tests deliberately do not cover:
 *   - Whether the layer exists; that needs the state, so the reducers in apps/server
 *     check it.
 *   - That the server's own steps still put graphics on an output; the reducer tests of
 *     takeItem, previewItem and takePreview in apps/server do.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from './command.js';

describe('CommandSchema', () => {
  const commandsThatNoLongerExistScenarios = [
    // The take by hand of "Edição rápida" before BAJAOVRLAY-37: on air with no item behind it.
    {
      name: 'refuses a takeGraphic of the race clock, naming type',
      command: {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: { sessionName: 'Enduro de Resistência', state: 'green' },
      },
    },
    // The same take aimed at the preview output, which takeGraphic used to accept too.
    {
      name: 'refuses a takeGraphic aimed at the preview output, naming type',
      command: {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: { sessionName: 'Enduro de Resistência', state: 'green' },
        target: 'preview',
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
    },
    // The "Prévia" of hand-typed data: a preview with no item behind it.
    {
      name: 'refuses a previewGraphic of the race clock, naming type',
      command: {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: { sessionName: 'Enduro de Resistência', state: 'yellow' },
        takeTimeFieldKeys: [],
      },
    },
  ];

  it.each(commandsThatNoLongerExistScenarios)('$name', ({ command }) => {
    // Arrange: a command a page written before BAJAOVRLAY-37 would send (table above).
    const commandFromAnOlderPage = command;

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(commandFromAnOlderPage);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused, and the message points at `type`: the command is unknown.
    expect(result.success, 'a graphic may reach an output only through an item').toBe(false);
    expect(failureMessage, 'the failure must name the type field').toContain('type');
  });

  const acceptedClearCommandScenarios = [
    // Clearing one layer, as the operator does to take the lower third off air.
    {
      name: 'accepts clearLayer for the lower third',
      command: { type: 'clearLayer', layerId: 'lower-third' },
    },
    // The auto-out's clear: the program output of one layer only, the preview kept.
    {
      name: 'accepts clearLayer aimed at the program output',
      command: { type: 'clearLayer', layerId: 'lower-third', target: 'program' },
    },
    // The panic button: everything off air at once.
    { name: 'accepts clearAll with no other field', command: { type: 'clearAll' } },
  ];

  it.each(acceptedClearCommandScenarios)('$name', ({ command }) => {
    // Arrange: the command as the control page sends it (from the table above).
    const commandFromControlPage = command;

    // Act: check the command.
    const result = CommandSchema.safeParse(commandFromControlPage);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a valid clear command must be accepted').toBe(true);
    expect(result.data, 'a clear command has no defaults to fill in').toEqual(command);
  });

  it('refuses a clearLayer aimed at the preview output, naming target', () => {
    // Arrange: a clear of the lower third's preview only, which stopPreview already does.
    const clearOfThePreviewOnly = { type: 'clearLayer', layerId: 'lower-third', target: 'preview' };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(clearOfThePreviewOnly);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at target.
    expect(result.success, 'clearLayer may be aimed at program only').toBe(false);
    expect(failureMessage, 'the failure must name the target field').toContain('target');
  });

  it('refuses a command type the server does not know, naming the type field', () => {
    // Arrange: a command from a future version of the control page. (Until BAJAOVRLAY-13
    // this example was takeItem, and until BAJAOVRLAY-16 runMacro; both are known now.
    // Overrides arrive in M2.)
    const unknownCommand = {
      type: 'setOverride',
      sourceId: 'scoring',
      path: 'enduro.positions',
      value: [],
    };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(unknownCommand);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at `type`.
    expect(result.success, 'an unknown command type must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the type field').toContain('type');
  });
});
