/**
 * A refused live refresh does not freeze the whole instance (apps/server)
 *
 * What this module is for:
 *   The refresher sends every live value of an instance as one set. If the graphic's
 *   schema refuses one of them (a source sends a title the clock cannot show), refusing
 *   the whole set froze everything else too: the flag and the clock stopped following
 *   the race (gate 2 of PR #18). Now the refresh tries the whole set first; if it is
 *   refused it applies the clock group (the four clock fields, always together) and each
 *   other field alone where they fit, keeps the refused fields as they are on air, and
 *   writes the refused keys on the instance's entry of `instanceBindings`, which Camadas
 *   shows as the chip "atualização recusada".
 *
 * What these tests prove:
 *   - With a title the schema refuses beside a yellow flag and a new clock reading, the
 *     flag and the clock go on air, the title stays, and the entry lists the title.
 *   - That first refusal asks the store for one failed event-log row; a later one in the
 *     same spell (the list already says so) changes nothing and asks for none.
 *   - A later refresh that fits as a whole clears that list.
 *   - An instance with no entry keeps nowhere to note the spell: its refresh is refused.
 *
 * What these tests deliberately do not cover:
 *   - The refresh with nothing refused; refreshBoundInstanceData.test.ts.
 *   - The chip; LayerStatusPanelBoundSources.test.tsx in apps/control.
 */
import type { Command, InstanceBindingsEntry } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroClockItemBoundToTheSimulator,
  buildLiveBindingToTheSimulatorSession,
  buildRaceDaySlicesWithTheSimulator,
} from '../../../core/store/reducers/boundItemSlices.testSupport.js';
import { reduceCommand } from '../../../core/store/reducers/reduceCommand.js';
import type { SlicesChangedByCommands } from '../../../core/store/reducers/reducerTypes.js';
import { contextOfTheRundownCommand } from '../../../core/store/reducers/rundownSlices.testSupport.js';

const clockOnAirId = 'relogio-no-ar';

/** Its live bindings: the title, the flag and the whole clock read from the simulator. */
function buildEntryOfTheClock(refusedFieldKeys?: string[]): InstanceBindingsEntry {
  return {
    instanceId: clockOnAirId,
    boundFields: [
      { fieldKey: 'sessionName', binding: buildLiveBindingToTheSimulatorSession('sessionName') },
      { fieldKey: 'state', binding: buildLiveBindingToTheSimulatorSession('state') },
      { fieldKey: 'referenceTimeMs', binding: buildLiveBindingToTheSimulatorSession('clock') },
    ],
    ...(refusedFieldKeys === undefined ? {} : { refusedFieldKeys }),
  };
}

/** A race day with the bound clock on air (green, counting down) and its entry. */
function buildRaceDayWithTheClockOnAir(entry: InstanceBindingsEntry): SlicesChangedByCommands {
  return buildRaceDaySlicesWithTheSimulator({
    items: [buildEnduroClockItemBoundToTheSimulator(0)],
    instances: [
      {
        id: clockOnAirId,
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: {
          sessionName: 'Enduro de Resistência',
          state: 'green',
          clockMode: 'remaining',
          referenceTimeMs: 4_559_052,
          referenceWallClockMs: 1_791_556_323_000,
          running: true,
        },
        currentStep: 0,
        status: 'on-air',
        takenAt: '2026-10-09T14:30:00.000Z',
      },
    ],
    instanceBindings: [entry],
  });
}

/** The refresher's command with this data. */
function buildRefresh(data: Record<string, unknown>): Command {
  return { type: 'refreshBoundInstanceData', instanceId: clockOnAirId, data };
}

// A poll: the yellow flag, the clock 30 s on, and a title the clock's schema refuses
// (a number where it shows text).
const refreshWithARefusedTitle = {
  sessionName: 4_242,
  state: 'yellow',
  referenceTimeMs: 4_529_052,
  referenceWallClockMs: 1_791_556_353_000,
  running: true,
  clockMode: 'remaining',
};

describe('refreshBoundInstanceData when part of it is refused', () => {
  it('puts the flag and the clock on air and keeps the refused title', () => {
    // Arrange: the clock on air, nothing refused so far.
    const slicesBefore = buildRaceDayWithTheClockOnAir(buildEntryOfTheClock());

    // Act: the refresh with a title the schema refuses.
    const outcome = reduceCommand(
      slicesBefore,
      buildRefresh(refreshWithARefusedTitle),
      contextOfTheRundownCommand,
    );

    // Assert: applied; the flag and the clock moved, the title did not, and the entry
    // names the title as refused.
    expect(outcome.status, 'the parts that fit must be applied').toBe('applied');
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : slicesBefore;
    expect(slicesAfter.instances[0]?.resolvedData, 'the flag and the clock follow').toEqual({
      sessionName: 'Enduro de Resistência',
      state: 'yellow',
      clockMode: 'remaining',
      referenceTimeMs: 4_529_052,
      referenceWallClockMs: 1_791_556_353_000,
      running: true,
    });
    expect(slicesAfter.instanceBindings, 'the entry must name the refused title').toEqual([
      buildEntryOfTheClock(['sessionName']),
    ]);
    expect(
      outcome.status === 'applied' && outcome.refusalWrittenToTheEventLog?.code,
      'the first refusal of a spell is logged as failed',
    ).toBe('INVALID_GRAPHIC_DATA');
  });

  it('clears the refused list when a later refresh fits as a whole', () => {
    // Arrange: the clock on air, its title refused before.
    const slicesBefore = buildRaceDayWithTheClockOnAir(buildEntryOfTheClock(['sessionName']));

    // Act: a refresh whose title fits again.
    const outcome = reduceCommand(
      slicesBefore,
      buildRefresh({ ...refreshWithARefusedTitle, sessionName: 'Enduro — reta final' }),
      contextOfTheRundownCommand,
    );

    // Assert: the entry has no refused list any more.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : slicesBefore;
    expect(slicesAfter.instanceBindings, 'the chip must go').toEqual([buildEntryOfTheClock()]);
  });

  it('changes nothing and logs nothing when nothing fits and the list already says so', () => {
    // Arrange: the clock on air, its title already listed as refused.
    const slicesBefore = buildRaceDayWithTheClockOnAir(buildEntryOfTheClock(['sessionName']));

    // Act: a refresh of the refused title alone.
    const outcome = reduceCommand(
      slicesBefore,
      buildRefresh({ sessionName: 4_242 }),
      contextOfTheRundownCommand,
    );

    // Assert: the very same slices and no row asked for: the spell is already logged.
    expect(outcome, 'a refusal already noted must leave no trace').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
  });

  it('refuses a refresh of an instance with no entry, having nowhere to note it', () => {
    // Arrange: the clock on air with no entry in instanceBindings.
    const slicesWithTheEntry = buildRaceDayWithTheClockOnAir(buildEntryOfTheClock());
    const slicesBefore = { ...slicesWithTheEntry, instanceBindings: [] };

    // Act: a refresh of a title the schema refuses.
    const outcome = reduceCommand(
      slicesBefore,
      buildRefresh({ sessionName: 4_242 }),
      contextOfTheRundownCommand,
    );

    // Assert: a plain refusal by the schema.
    expect(outcome.status === 'refused' && outcome.error.code, 'refused as a whole').toBe(
      'INVALID_GRAPHIC_DATA',
    );
  });
});
