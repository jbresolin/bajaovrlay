/**
 * "Tomar tudo" with a layer another console just changed (apps/server)
 *
 * What this module is for:
 *   "Tomar tudo" takes every layer Prévia shows in one cut. When another console changed one
 *   of those layers less than 2 s ago, unseen by this console (BAJAOVRLAY-69), that layer is
 *   checked on its own: it is left as it is, its preview or "vai limpar" mark kept so the
 *   operator can look and take again, and the other layers are still taken.
 *
 * What these tests prove:
 *   - With the clock's preview and the chief's on "Tarja", Mesa 1 having just taken the
 *     captain on "Tarja": the clock is taken, the captain stays on "Tarja", the chief stays
 *     in Prévia, and the outcome lists "Tarja" with its refusal and both roles.
 *   - A "vai limpar" mark on such a layer is kept, and the refusal says the clear was not done.
 *   - When every layer is left that way, nothing is taken and the command is refused.
 *   - From the command API (no console) the same set is taken whole, as before.
 *
 * What these tests deliberately do not cover:
 *   - The rule itself, case by case: consoles/unseenChangeByAnotherConsole.test.ts.
 *   - "Tomar tudo" without another console: takeAllPreviews.test.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildCaptainLowerThirdItem,
  buildCaptainOnProgram,
  buildChiefLowerThirdItem,
  buildChiefOnPreview,
  buildContextOfMesa2,
  buildContextOfTheCommandApi,
  buildMesa1TookTheCaptain,
  momentMesa1TookTheCaptain,
  refusalOfTheChiefOverTheCaptain,
} from '../consoles/twoConsolesOnOneLayerFixtures.testSupport.js';
import { buildYellowFlagItemOnPreview } from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import { buildRaceDaySlicesWithRundown, buildYellowFlagItem } from './rundownSlices.testSupport.js';

/** Builds the race day with both lower thirds, the yellow flag item and the given instances. */
function buildRaceDayWithPreviews(parts: {
  instances: Instance[];
  previewClearedLayerIds?: string[];
}) {
  return buildRaceDaySlicesWithRundown({
    items: [buildCaptainLowerThirdItem(), buildChiefLowerThirdItem(), buildYellowFlagItem(1)],
    instances: parts.instances,
    previewClearedLayerIds: parts.previewClearedLayerIds ?? [],
  });
}

/** Reads each instance as `layer on output: item`, sorted. */
function readWhatEachOutputShows(instances: Instance[]): string[] {
  return instances
    .map((instance) => `${instance.layerId} on ${instance.target}: ${instance.itemId ?? 'no item'}`)
    .sort();
}

describe('"Tomar tudo" with one layer just changed by another console', () => {
  it('takes the other layers, leaves that one with its preview, and lists it with why', () => {
    // Arrange: in Prévia, the yellow flag on "Relógio" and the chief on "Tarja"; on air, the
    // captain Mesa 1 took 0,8 s ago; Mesa 2 showed both layers empty.
    const slicesBefore = buildRaceDayWithPreviews({
      instances: [buildCaptainOnProgram(), buildYellowFlagItemOnPreview(), buildChiefOnPreview()],
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses "Tomar tudo".
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'takeAllPreviews',
        instanceIdsSeenOnAir: { clock: null, 'lower-third': null },
      },
      context,
    );

    // Assert: the clock went to program; "Tarja" kept the captain and the chief's preview;
    // "Tarja" is listed with the refusal and both roles.
    if (outcome.status !== 'applied') {
      throw new Error(`"Tomar tudo" must still take the clock, but: ${outcome.error.message}`);
    }
    expect(
      readWhatEachOutputShows(outcome.slices.instances),
      'the clock must be taken, and "Tarja" left exactly as it was',
    ).toEqual([
      'clock on program: item-bandeira-amarela',
      'lower-third on preview: item-tarja-chefe-ufsc',
      'lower-third on program: item-tarja-capita-ufpr',
    ]);
    expect(outcome.layersNotTaken, 'the page must be told which layer was left, and why').toEqual([
      {
        layerId: 'lower-third',
        error: {
          code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
          message: refusalOfTheChiefOverTheCaptain,
        },
      },
    ]);
    expect(
      outcome.takesRefusedForAnotherConsole,
      'the event log must keep both roles of the layer left',
    ).toEqual([
      {
        layerId: 'lower-third',
        refusedConsoleRole: 'produtor',
        otherConsoleRole: 'produtor',
        otherConsoleChangedAt: momentMesa1TookTheCaptain,
      },
    ]);
  });

  it('keeps the "vai limpar" mark of the layer left, saying its clear was not done', () => {
    // Arrange: the yellow flag in Prévia on "Relógio", "Tarja" marked "vai limpar"; the
    // captain Mesa 1 took 0,8 s ago on air.
    const slicesBefore = buildRaceDayWithPreviews({
      instances: [buildCaptainOnProgram(), buildYellowFlagItemOnPreview()],
      previewClearedLayerIds: ['lower-third'],
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses "Tomar tudo".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeAllPreviews', instanceIdsSeenOnAir: { clock: null, 'lower-third': null } },
      context,
    );

    // Assert: the captain stays, the mark stays, and the reason names the clear.
    if (outcome.status !== 'applied') {
      throw new Error(`"Tomar tudo" must still take the clock, but: ${outcome.error.message}`);
    }
    expect(
      outcome.slices.previewClearedLayerIds,
      'the mark of the layer left must stay, to clear it later',
    ).toEqual(['lower-third']);
    expect(
      outcome.layersNotTaken?.[0]?.error.message,
      'the refusal must say the clear was not done',
    ).toBe(
      'Outra mesa (Produtor) tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; ' +
        'sua limpeza desta camada não foi feita.',
    );
  });

  it('refuses the whole command when every layer was just changed by another console', () => {
    // Arrange: only the chief in Prévia; the captain Mesa 1 took 0,8 s ago on air.
    const slicesBefore = buildRaceDayWithPreviews({
      instances: [buildCaptainOnProgram(), buildChiefOnPreview()],
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses "Tomar tudo".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeAllPreviews', instanceIdsSeenOnAir: { 'lower-third': null } },
      context,
    );

    // Assert: refused, with the sentence of the layer, and both roles kept.
    expect(outcome, 'nothing taken is a refusal, naming what happened').toEqual({
      status: 'refused',
      error: {
        code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
        message: `Tomar tudo não foi feito: ${refusalOfTheChiefOverTheCaptain}`,
      },
      takesRefusedForAnotherConsole: [
        {
          layerId: 'lower-third',
          refusedConsoleRole: 'produtor',
          otherConsoleRole: 'produtor',
          otherConsoleChangedAt: momentMesa1TookTheCaptain,
        },
      ],
    });
  });

  it('takes the whole set from the command API, which is never guarded', () => {
    // Arrange: the same two previews and the captain Mesa 1 took 0,8 s ago.
    const slicesBefore = buildRaceDayWithPreviews({
      instances: [buildCaptainOnProgram(), buildYellowFlagItemOnPreview(), buildChiefOnPreview()],
    });
    const context = buildContextOfTheCommandApi({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: a Companion button sends "Tomar tudo".
    const outcome = reduceCommand(slicesBefore, { type: 'takeAllPreviews' }, context);

    // Assert: both layers taken, none listed.
    if (outcome.status !== 'applied') {
      throw new Error(
        `the command API's "Tomar tudo" must be taken, but: ${outcome.error.message}`,
      );
    }
    expect(
      readWhatEachOutputShows(outcome.slices.instances),
      'both previews must go to program, the chief replacing the captain',
    ).toEqual([
      'clock on program: item-bandeira-amarela',
      'lower-third on program: item-tarja-chefe-ufsc',
    ]);
    expect(outcome.layersNotTaken, 'no layer may be left').toBeUndefined();
  });
});
