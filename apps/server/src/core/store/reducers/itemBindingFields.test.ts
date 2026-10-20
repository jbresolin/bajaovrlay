/**
 * Saving items whose fields read from a data source (apps/server)
 *
 * What this module is for:
 *   An item field may hold a binding instead of a typed value: "read this from that
 *   source". createItem and updateItemFields check every binding they carry when the
 *   item is saved, so the operator hears of a mistake while preparing the show and not
 *   when pressing Space on air: the source must exist, the binding's parts must make
 *   sense (findProblemInBinding in shared), the value must fit the graphic's field, and
 *   a whole clock ("Relógio da fonte") must be the only thing filling the four clock
 *   fields. Each refusal is INVALID_BINDING with a pt-BR message that starts with the
 *   field's title, as the editor shows it.
 *
 * What these tests prove:
 *   - The race clock with its flag bound live and its whole clock read from the
 *     simulator is created, and stored exactly as sent.
 *   - Each mistake is refused with its message: an unknown source, a path the session
 *     does not list, a text on the running switch, the whole clock on the running
 *     switch, and the whole clock beside a typed reference moment.
 *   - updateItemFields refuses a binding to an unknown source the same way, and a
 *     takeTime sent onto the moment of a clock bound whole; it accepts switching a
 *     typed flag to a bound one.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of findProblemInBinding and of the field types, which the shared tests
 *     cover row by row; here one row of each kind shows the server runs them.
 *   - Reading the bound values at the take; resolveItemFields.test.ts.
 */
import type { CreateItemCommand, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroClockFieldsBoundToTheSimulator,
  buildEnduroClockItemBoundToTheSimulator,
  buildLiveBindingToTheSimulatorSession,
  buildRaceDaySlicesWithTheSimulator,
} from './boundItemSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import { contextOfTheRundownCommand, mainSessionRundownId } from './rundownSlices.testSupport.js';

/** The createItem the item editor sends for "Relógio do enduro — fonte", with these fields. */
function buildCreateBoundEnduroClockCommand(fields: ItemFields): CreateItemCommand {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: mainSessionRundownId },
    graphicId: 'race-clock',
    layerId: 'clock',
    fields,
    label: 'Relógio do enduro — fonte',
    color: 'success',
    notes: '',
  };
}

describe('createItem with fields bound to a data source', () => {
  it('stores the race clock whose flag and whole clock follow the simulator, as sent', () => {
    // Arrange: a race day with the simulator on and no item yet.
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({ items: [] });
    const command = buildCreateBoundEnduroClockCommand(buildEnduroClockFieldsBoundToTheSimulator());

    // Act: save the bound clock.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: created, with its bindings exactly as the editor sent them.
    expect(outcome.status, 'the bound clock must be created').toBe('applied');
    const itemsAfter = outcome.status === 'applied' ? outcome.slices.items : [];
    expect(itemsAfter[0]?.fields, 'the bindings must be stored as sent').toEqual(command.fields);
  });

  const refusedBindingScenarios: Array<{ name: string; fields: ItemFields; message: string }> = [
    // A source that was never created (or was deleted): the field would read nothing.
    {
      name: 'refuses a flag bound to a source that does not exist, naming the field',
      fields: {
        ...buildEnduroClockFieldsBoundToTheSimulator(),
        state: { ...buildLiveBindingToTheSimulatorSession('state'), sourceId: 'cronometragem' },
      },
      message: 'Bandeira: a fonte de dados "cronometragem" não existe.',
    },
    // A path typed by hand through the API that the picker never offered.
    {
      name: 'refuses a path the session does not list, naming the field',
      fields: {
        ...buildEnduroClockFieldsBoundToTheSimulator(),
        state: buildLiveBindingToTheSimulatorSession('bandeira'),
      },
      message: 'Bandeira: O caminho "bandeira" não é um dos que a forma Sessão oferece.',
    },
    // A text on a switch: the take would always be refused by the graphic's schema.
    {
      name: 'refuses the session name on the running switch, naming the field',
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'green' },
        clockMode: { kind: 'literal', value: 'remaining' },
        referenceTimeMs: { kind: 'literal', value: 14_400_000 },
        referenceWallClockMs: { kind: 'takeTime' },
        running: buildLiveBindingToTheSimulatorSession('sessionName'),
      },
      message: 'Relógio correndo: Sessão › Nome da sessão não serve para este campo.',
    },
    // The whole clock goes on the time field, the one the editor stores it on.
    {
      name: 'refuses the whole clock on the running switch, naming the field',
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'green' },
        running: buildLiveBindingToTheSimulatorSession('clock'),
      },
      message: 'Relógio correndo: Sessão › Relógio completo não serve para este campo.',
    },
    // The whole clock fills the reference moment too; a takeTime there would stamp the
    // moment of the take over the source's and make the clock jump.
    {
      name: 'refuses the whole clock beside a reference moment stamped at the take',
      fields: {
        ...buildEnduroClockFieldsBoundToTheSimulator(),
        referenceWallClockMs: { kind: 'takeTime' },
      },
      message:
        'Tempo de referência: o Relógio completo preenche também "Horário da referência", que deve ficar sem valor.',
    },
  ];

  it.each(refusedBindingScenarios)('$name', ({ fields, message }) => {
    // Arrange: a race day with the simulator on and no item yet.
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({ items: [] });

    // Act: try to save the item of this row.
    const outcome = reduceCommand(
      slicesBefore,
      buildCreateBoundEnduroClockCommand(fields),
      contextOfTheRundownCommand,
    );

    // Assert: refused as an invalid binding, with the field's title first.
    expect(outcome, 'the item must be refused with the pt-BR message').toEqual({
      status: 'refused',
      error: { code: 'INVALID_BINDING', message },
    });
  });
});

describe('updateItemFields with fields bound to a data source', () => {
  it('refuses a flag bound to a source that does not exist and changes nothing', () => {
    // Arrange: the bound clock already in the rundown.
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({
      items: [buildEnduroClockItemBoundToTheSimulator(0)],
    });

    // Act: point its flag at a source that does not exist.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateItemFields',
        itemId: buildEnduroClockItemBoundToTheSimulator(0).id,
        fields: {
          state: { ...buildLiveBindingToTheSimulatorSession('state'), sourceId: 'cronometragem' },
        },
      },
      contextOfTheRundownCommand,
    );

    // Assert: refused like a create; a refusal never carries new slices.
    expect(outcome, 'the update must be refused with the pt-BR message').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_BINDING',
        message: 'Bandeira: a fonte de dados "cronometragem" não existe.',
      },
    });
  });

  it('refuses a reference moment stamped at the take on a clock bound whole', () => {
    // Arrange: the bound clock, whose whole clock comes from the simulator.
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({
      items: [buildEnduroClockItemBoundToTheSimulator(0)],
    });

    // Act: send only a takeTime for the reference moment, no binding at all.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateItemFields',
        itemId: buildEnduroClockItemBoundToTheSimulator(0).id,
        fields: { referenceWallClockMs: { kind: 'takeTime' } },
      },
      contextOfTheRundownCommand,
    );

    // Assert: refused, because the item as it would be stored mixes the two.
    expect(outcome, 'the stamp beside the whole clock must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_BINDING',
        message:
          'Tempo de referência: o Relógio completo preenche também "Horário da referência", que deve ficar sem valor.',
      },
    });
  });

  it('accepts switching the flag from typed to bound live', () => {
    // Arrange: the bound clock, then its flag typed by hand as yellow.
    const itemWithTypedFlag = {
      ...buildEnduroClockItemBoundToTheSimulator(0),
      fields: {
        ...buildEnduroClockFieldsBoundToTheSimulator(),
        state: { kind: 'literal' as const, value: 'yellow' },
      },
    };
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({ items: [itemWithTypedFlag] });

    // Act: bind the flag to the simulator again.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateItemFields',
        itemId: itemWithTypedFlag.id,
        fields: { state: buildLiveBindingToTheSimulatorSession('state') },
      },
      contextOfTheRundownCommand,
    );

    // Assert: saved, the flag now a binding.
    expect(outcome.status, 'the update must be applied').toBe('applied');
    const itemAfter = outcome.status === 'applied' ? outcome.slices.items[0] : undefined;
    expect(itemAfter?.fields.state, 'the flag must now be bound').toEqual(
      buildLiveBindingToTheSimulatorSession('state'),
    );
  });
});
