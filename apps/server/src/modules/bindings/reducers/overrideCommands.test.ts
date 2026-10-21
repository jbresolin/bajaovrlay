/**
 * setOverride and clearOverride: the operator's corrections (apps/server)
 *
 * What this module is for:
 *   An override corrects what one source says until it is cleared, everywhere that
 *   source is bound (concept §4). setOverride stores it, stamped with who set it and
 *   when, replacing a correction of the same key (source, scope, field, car);
 *   clearOverride removes it. The refresher then rewrites every bound instance on air
 *   (liveRefresher.ts), and every take reads the corrected value.
 *
 * What these tests prove:
 *   - A session name correction is stored with the operator who set it and the moment.
 *   - A second correction of the same key replaces the first in its place; one of another
 *     car is kept beside it.
 *   - A correction of a source that does not exist is refused (DATA_SOURCE_NOT_FOUND),
 *     and one whose value does not fit the field is refused (INVALID_OVERRIDE_VALUE),
 *     naming the field.
 *   - clearOverride removes the correction of its key and no other; clearing a
 *     correction that is not there changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - Who may send them (operators only); overridesThroughTheStore.test.ts.
 *   - The refresh on air; overridesThroughTheStore.test.ts.
 */
import type { Override } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildCarOverride,
  buildRaceDaySlicesWithTheSimulator,
  buildSessionNameOverride,
} from '../../../core/store/reducers/boundItemSlices.testSupport.js';
import { reduceCommand } from '../../../core/store/reducers/reduceCommand.js';
import type { SlicesChangedByCommands } from '../../../core/store/reducers/reducerTypes.js';
import { contextOfTheRundownCommand } from '../../../core/store/reducers/rundownSlices.testSupport.js';

/** A race day with the simulator on and the corrections given. */
function buildRaceDayWithOverrides(overrides: Override[]): SlicesChangedByCommands {
  return { ...buildRaceDaySlicesWithTheSimulator({ items: [] }), overrides };
}

/** The setOverride the "Fontes" page sends for car 42's team name. */
function buildSetCar42TeamName(teamName: string) {
  return {
    type: 'setOverride' as const,
    sourceId: 'simulador-enduro',
    scope: 'car' as const,
    carNumber: 42,
    field: 'teamName',
    value: teamName,
    reason: 'A equipe pediu a correção na secretaria de prova.',
  };
}

describe('setOverride', () => {
  it('stores a session name correction with who set it and when', () => {
    // Arrange: a race day with no correction.
    const slicesBefore = buildRaceDayWithOverrides([]);

    // Act: the operator corrects the session name.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'setOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'sessionName',
        value: 'Enduro — Etapa Nacional',
        reason: 'Nome oficial da prova.',
      },
      contextOfTheRundownCommand,
    );

    // Assert: stored, signed by the operator at the command's moment.
    expect(outcome.status === 'applied' && outcome.slices.overrides, 'one correction').toEqual([
      {
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'sessionName',
        value: 'Enduro — Etapa Nacional',
        reason: 'Nome oficial da prova.',
        setBy: contextOfTheRundownCommand.actor,
        setAt: contextOfTheRundownCommand.now,
      },
    ]);
  });

  it('replaces a correction of the same car and field, and keeps one of another car', () => {
    // Arrange: corrections of car 42's team and car 31's school.
    const slicesBefore = buildRaceDayWithOverrides([
      buildCarOverride(42, 'teamName', 'Jequitiba Racing'),
      buildCarOverride(31, 'schoolName', 'Instituto Mauá'),
    ]);

    // Act: car 42's team corrected again, with the accent.
    const outcome = reduceCommand(
      slicesBefore,
      buildSetCar42TeamName('Jequitibá Racing'),
      contextOfTheRundownCommand,
    );

    // Assert: car 42's correction holds only the new value, in the place it had, and car
    // 31's is kept after it.
    const overridesAfter = outcome.status === 'applied' ? outcome.slices.overrides : [];
    expect(
      overridesAfter.map((override) => [
        override.scope === 'car' ? override.carNumber : undefined,
        override.field,
        override.value,
      ]),
      'one correction per key, the newest, in its place',
    ).toEqual([
      [42, 'teamName', 'Jequitibá Racing'],
      [31, 'schoolName', 'Instituto Mauá'],
    ]);
  });

  it('refuses a correction of a source that does not exist', () => {
    // Arrange: a race day with the simulator only.
    const slicesBefore = buildRaceDayWithOverrides([]);

    // Act: a correction of the timing system, which was never created.
    const outcome = reduceCommand(
      slicesBefore,
      { ...buildSetCar42TeamName('Jequitibá Racing'), sourceId: 'cronometragem' },
      contextOfTheRundownCommand,
    );

    // Assert: refused as an unknown source.
    expect(outcome.status === 'refused' && outcome.error.code, 'unknown source').toBe(
      'DATA_SOURCE_NOT_FOUND',
    );
  });

  it('refuses a value that does not fit the field, naming it', () => {
    // Arrange: a race day with no correction.
    const slicesBefore = buildRaceDayWithOverrides([]);

    // Act: a flag the graphics do not know.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'setOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'state',
        value: 'azul',
        reason: 'Teste.',
      },
      contextOfTheRundownCommand,
    );

    // Assert: refused with the pt-BR sentence of the value check.
    expect(outcome, 'a value that does not fit must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_OVERRIDE_VALUE',
        message: 'O valor "azul" não serve para Sessão › Bandeira.',
      },
    });
  });
});

describe('clearOverride', () => {
  it('removes the correction of its key and keeps the others', () => {
    // Arrange: a session name correction and one of car 42.
    const slicesBefore = buildRaceDayWithOverrides([
      buildSessionNameOverride('Enduro — Etapa Nacional'),
      buildCarOverride(42, 'teamName', 'Jequitibá Racing'),
    ]);

    // Act: remove the session name correction.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'clearOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'sessionName',
      },
      contextOfTheRundownCommand,
    );

    // Assert: car 42's correction alone is left.
    expect(outcome.status === 'applied' && outcome.slices.overrides, 'only car 42 left').toEqual([
      buildCarOverride(42, 'teamName', 'Jequitibá Racing'),
    ]);
  });

  it('changes nothing when the correction is not there', () => {
    // Arrange: a race day with no correction.
    const slicesBefore = buildRaceDayWithOverrides([]);

    // Act: remove a correction nobody set.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'clearOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'sessionName',
      },
      contextOfTheRundownCommand,
    );

    // Assert: the very same slices, so nothing is saved, logged or broadcast.
    expect(outcome, 'clearing nothing must leave no trace').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
  });
});
