/**
 * An item filled by an event is never taken by itself, whatever path tries (apps/server)
 *
 * What this module is for:
 *   An item whose fields read the event it shows is a template: with no event it has
 *   nothing to show (BAJAOVRLAY-44). Every way an operator can put an item on air must
 *   refuse it with the same pt-BR reason, "Este item é preenchido por um evento", so a
 *   notice never goes on air with sample data or empty fields. Gate 2 of PR #22 asked for
 *   one row per path.
 *
 * What these tests prove, one row each:
 *   - takeNext (Space) with the template at the rundown's cursor;
 *   - takeItem from a shortcut button of "Atalhos";
 *   - runMacro of a macro with a step taking the template (refused before any step runs);
 *   - previewMacro of that macro;
 *   - takeAllPreviews ("Tomar tudo") with the template previewed from its sample.
 *
 * What these tests deliberately do not cover:
 *   - takeItem of a rundown row and "Tomar"; eventFieldsOnTheStore.test.ts.
 *   - The control page, which also turns these takes off (features/events).
 */
import { describe, expect, it } from 'vitest';

import {
  applyOrThrow,
  openEventInboxOnTheStore,
  operatorActor,
  startOfTheTests,
} from './eventInboxOnTheStore.testSupport.js';

/** The fields of a race clock whose title reads the event's team, as a template. */
function buildTemplateClockFields() {
  return {
    sessionName: { kind: 'eventField' as const, path: 'teamName' as const },
    state: { kind: 'literal' as const, value: 'green' },
    clockMode: { kind: 'literal' as const, value: 'remaining' },
    referenceTimeMs: { kind: 'literal' as const, value: 4_560_000 },
    referenceWallClockMs: { kind: 'literal' as const, value: Date.parse(startOfTheTests) },
    running: { kind: 'literal' as const, value: true },
  };
}

const takeScenarios: Array<{
  name: string;
  /** The template's home, and what to send once it exists (its id handed in). */
  home: Record<string, unknown>;
  buildCommandsOfTheTake: (templateItemId: string) => Array<Record<string, unknown>>;
}> = [
  // Space with the template at the cursor: the first item of a rundown gets the cursor.
  {
    name: 'refuses takeNext with the template at the cursor (Space)',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    buildCommandsOfTheTake: () => [{ type: 'takeNext', rundownId: 'sessao-principal' }],
  },
  // A button of "Atalhos" sends takeItem.
  {
    name: 'refuses takeItem from a shortcut button',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    buildCommandsOfTheTake: (templateItemId) => [{ type: 'takeItem', itemId: templateItemId }],
  },
  // A macro taking the template: refused at "Executar", before any step can run.
  {
    name: 'refuses runMacro of a macro that takes the template',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    buildCommandsOfTheTake: () => [{ type: 'runMacro', macroId: 'macro-aviso' }],
  },
  // The macro's Prévia previews its steps: the template has no event to fill it.
  {
    name: 'refuses previewMacro of that macro',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    buildCommandsOfTheTake: () => [{ type: 'previewMacro', macroId: 'macro-aviso' }],
  },
  // "Tomar tudo" with the template previewed from its sample event.
  {
    name: 'refuses takeAllPreviews with the template previewed from its sample',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    buildCommandsOfTheTake: (templateItemId) => [
      { type: 'previewItem', itemId: templateItemId },
      { type: 'takeAllPreviews' },
    ],
  },
];

describe('a take of an item filled by an event', () => {
  it.each(takeScenarios)('$name', ({ home, buildCommandsOfTheTake }) => {
    // Arrange: the template in this row's home, and a macro "Aviso" whose one step takes it.
    const inbox = openEventInboxOnTheStore(undefined, () => 'relogio-aviso');
    applyOrThrow(inbox.stateStore, {
      type: 'createItem',
      home,
      graphicId: 'race-clock',
      layerId: 'clock',
      label: 'Relógio — aviso',
      fields: buildTemplateClockFields(),
    });
    const outcomeOfTheMacro = inbox.stateStore.applyCommand(
      {
        type: 'createMacro',
        label: 'Aviso',
        color: 'warning',
        steps: [{ kind: 'takeItem', itemId: 'relogio-aviso' }],
      },
      operatorActor,
    );
    expect(outcomeOfTheMacro.ok, 'the macro is made (its run is what must be refused)').toBe(true);
    const macroId = inbox.stateStore.readAllSlices().macros[0]?.id ?? '';
    const commands = buildCommandsOfTheTake('relogio-aviso').map((command) =>
      command.macroId === undefined ? command : { ...command, macroId },
    );

    // Act: send this row's commands; the last one is the take.
    const outcomes = commands.map((command) =>
      inbox.stateStore.applyCommand(command, operatorActor),
    );

    // Assert: the take is refused with the template's reason (after the context "Tomar
    // tudo" and a macro's Prévia put first), and nothing is on program.
    const outcomeOfTheTake = outcomes.at(-1);
    const errorOfTheTake = outcomeOfTheTake?.ok === false ? outcomeOfTheTake.error : undefined;
    expect(errorOfTheTake?.code, 'the take must be refused as a template').toBe(
      'ITEM_FILLED_BY_EVENT',
    );
    expect(errorOfTheTake?.message, 'the refusal must end with the reason').toMatch(
      /Este item é preenchido por um evento: ele entra no ar pela aba Eventos\.$/,
    );
    expect(
      inbox.stateStore
        .readAllSlices()
        .instances.filter((instance) => instance.target === 'program'),
      'nothing may go on air',
    ).toEqual([]);
  });
});
