/**
 * Every N minutes and the plain sponsor roll on air (apps/server)
 *
 * What this module is for:
 *   The "Horário" trigger every N minutes (BAJAOVRLAY-64) brings the plain sponsor roll back,
 *   and the roll leaves by itself when its pass ends. One rule is the interval trigger's own:
 *   while the layer of an item its macro takes has anything on program (the roll's pass has
 *   not ended), a firing does nothing, and the server log says why. These tests are where
 *   the trigger meets the roll on air; intervalTriggers.test.ts holds the schedule itself.
 *
 * What these tests prove, on fake time from 11:00 in São Paulo on race day:
 *   - A firing while the roll's layer has anything on program does nothing and logs why: the
 *     roll itself, a copy of the roll (another item), or the roll sent from its preview; once
 *     the layer is free (cleared, or the pass over with the auto-out), the next firing takes
 *     the roll again.
 *   - A roll whose sponsors have no logo stops its macro at the take, saying why in pt-BR.
 *   - A restart in the middle of a pass takes the roll off air (its auto-out lived in memory),
 *     so it is never stuck on its last sponsor blocking the trigger; the next moment takes it.
 *
 * What these tests deliberately do not cover:
 *   - The schedule's own rules (window, sleep, pause); intervalTriggers.test.ts.
 *   - The roll's pass length and the refusal of a take with nothing to show;
 *     core/store/plainSponsorRollAutoOut.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildSponsorsEveryMinutesTrigger,
  oneMinuteMs,
  readFiringTimesOfDay,
} from './intervalTriggers.testSupport.js';
import {
  applyAsTheOperatorOrThrow,
  createTrigger,
  plainSponsorRollItemId,
  plainSponsorRollMacroId,
  plainSponsorRollPassMs,
  readDataOnAirOnLayer,
  readFirings,
  startTriggersOnTheStore,
} from './triggersOnTheStore.testSupport.js';

describe('while the roll is still on air', () => {
  it('does nothing, and logs why', () => {
    // Arrange: auto every 5 minutes, no auto-out, so the roll taken at 11:05 stays up.
    const { store, passTime, readRecordedLogLines } = startTriggersOnTheStore();
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5, { mode: 'auto' }));
    passTime(5 * oneMinuteMs + 1_000);
    const rollTakenAt1105 = readDataOnAirOnLayer(store, 'sponsor-roll-plain');

    // Act: 11:10 comes with the roll still on air.
    passTime(5 * oneMinuteMs);

    // Assert: on air at 11:05, still the one firing at 11:10, and a log line naming why.
    expect(rollTakenAt1105, 'the roll went on air at 11:05').toBeDefined();
    expect(readFiringTimesOfDay(store), 'no firing over a roll still on air').toEqual(['11:05']);
    const notFiredLines = readRecordedLogLines().filter((line) =>
      line.message.includes('still on air'),
    );
    expect(notFiredLines[0], 'the log must name the trigger and say why in pt-BR').toMatchObject({
      level: 'info',
      trigger_name: 'Patrocinadores a cada 5 min',
      reason:
        'O gatilho "Patrocinadores a cada 5 min" não disparou: a camada "Patrocinadores (rodízio)" ainda tem um gráfico no ar.',
    });
  });

  it('does nothing while a copy of the roll, another item, is on air on the roll’s layer', () => {
    // Arrange: auto every 5 minutes; the operator made a copy of the roll item and took it.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5, { mode: 'auto' }));
    applyAsTheOperatorOrThrow(store, {
      type: 'createItem',
      home: { kind: 'quickFire', panelId: 'atalhos' },
      graphicId: 'sponsor-roll-plain',
      layerId: 'sponsor-roll-plain',
      label: 'Patrocinadores (cópia)',
      fields: {
        sponsors: {
          kind: 'literal',
          value: [{ name: 'Bosch', level: 'diamante', logoUrl: '/media/logo-bosch.png' }],
        },
      },
    });
    const copyItemId = store.readAllSlices().items.at(-1)?.id ?? '';
    applyAsTheOperatorOrThrow(store, { type: 'takeItem', itemId: copyItemId });

    // Act: 11:05 comes with the copy on air.
    passTime(5 * oneMinuteMs + 1_000);

    // Assert: no firing; the copy is still the one on air.
    expect(readFirings(store), 'the layer is busy, whichever item holds it').toEqual([]);
    expect(
      store.readAllSlices().instances.find((instance) => instance.layerId === 'sponsor-roll-plain')
        ?.itemId,
      'the copy keeps the layer',
    ).toBe(copyItemId);
  });

  it('does nothing while the roll is on air from "Prévia" and "Tomar"', () => {
    // Arrange: auto every 5 minutes; the operator previewed the roll and sent it to air.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5, { mode: 'auto' }));
    applyAsTheOperatorOrThrow(store, {
      type: 'previewItem',
      itemId: plainSponsorRollItemId,
      origin: 'manual',
    });
    applyAsTheOperatorOrThrow(store, { type: 'takePreview', layerId: 'sponsor-roll-plain' });

    // Act: 11:05 comes with that roll on air.
    passTime(5 * oneMinuteMs + 1_000);

    // Assert: no firing over it.
    expect(readFirings(store), 'a roll sent to air from its preview keeps the layer busy').toEqual(
      [],
    );
  });

  it('takes the roll again at the next moment once the roll was cleared', () => {
    // Arrange: auto every 5 minutes, no auto-out; the roll went up at 11:05.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5, { mode: 'auto' }));
    passTime(5 * oneMinuteMs + 1_000);

    // Act: the operator clears the roll's layer, and 11:10 comes.
    applyAsTheOperatorOrThrow(store, {
      type: 'clearLayer',
      layerId: 'sponsor-roll-plain',
      target: 'program',
    });
    passTime(5 * oneMinuteMs);

    // Assert: a second firing, and the roll back on air.
    expect(readFiringTimesOfDay(store), 'the layer is free, so 11:10 fires').toEqual([
      '11:05',
      '11:10',
    ]);
    expect(readDataOnAirOnLayer(store, 'sponsor-roll-plain'), 'the roll is up again').toBeDefined();
  });

  it('leaves after its pass with the auto-out, and comes back at the next moment', () => {
    // Arrange: auto every 5 minutes, the auto-out running.
    const { store, passTime } = startTriggersOnTheStore({ isAutoOutRunning: true });
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5, { mode: 'auto' }));

    // Act: 11:05 comes, then the pass's 13,4 s, then 11:10.
    passTime(5 * oneMinuteMs + 1_000);
    const isOnAirAt1105 = readDataOnAirOnLayer(store, 'sponsor-roll-plain') !== undefined;
    passTime(plainSponsorRollPassMs);
    const isOnAirAfterThePass = readDataOnAirOnLayer(store, 'sponsor-roll-plain') !== undefined;
    passTime(5 * oneMinuteMs - plainSponsorRollPassMs);

    // Assert: up at 11:05, gone after its pass, up again at 11:10.
    expect(isOnAirAt1105, 'the roll goes on air at 11:05').toBe(true);
    expect(isOnAirAfterThePass, 'the roll leaves when its pass ends').toBe(false);
    expect(readFiringTimesOfDay(store), 'both moments fired').toEqual(['11:05', '11:10']);
  });
});

describe('a roll with nothing to show', () => {
  it('stops the macro at its take, saying why in pt-BR, and leaves the layer empty', () => {
    // Arrange: auto every 5 minutes; the roll's sponsors were typed with no logo.
    const { store, passTime } = startTriggersOnTheStore();
    applyAsTheOperatorOrThrow(store, {
      type: 'updateItemFields',
      itemId: plainSponsorRollItemId,
      fields: {
        sponsors: { kind: 'literal', value: [{ name: 'Randon', level: 'prata', logoUrl: '' }] },
      },
    });
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5, { mode: 'auto' }));

    // Act: 11:05 comes.
    passTime(5 * oneMinuteMs + 1_000);

    // Assert: the firing ran its macro, which stopped at the take with the reason on its
    // button; the layer stays empty.
    expect(readFiringTimesOfDay(store), 'the trigger fired').toEqual(['11:05']);
    expect(
      store.readAllSlices().macroStops.find((stop) => stop.macroId === plainSponsorRollMacroId),
      'the macro’s button says why it stopped',
    ).toMatchObject({
      stepIndex: 0,
      reason:
        'O gráfico "sponsor-roll-plain" não tem o que mostrar: nenhum patrocinador da lista tem logo.',
    });
    expect(readDataOnAirOnLayer(store, 'sponsor-roll-plain'), 'nothing on air').toBeUndefined();
  });
});

describe('a restart in the middle of a pass', () => {
  it('a roll on air at a restart is off air after it, and the trigger’s next moment takes it again', () => {
    // Arrange: auto every 5 minutes, the auto-out running; the roll went up at 11:05.
    const { store, passTime, restartTheServer } = startTriggersOnTheStore({
      isAutoOutRunning: true,
    });
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5, { mode: 'auto' }));
    passTime(5 * oneMinuteMs + 1_000);
    const isOnAirBeforeTheRestart = readDataOnAirOnLayer(store, 'sponsor-roll-plain') !== undefined;

    // Act: the server restarts 4 s into the pass, whose auto-out lived in memory; then 11:10
    // comes.
    passTime(4_000);
    const storeAfterTheRestart = restartTheServer();
    const isOnAirRightAfterTheRestart =
      readDataOnAirOnLayer(storeAfterTheRestart, 'sponsor-roll-plain') !== undefined;
    passTime(5 * oneMinuteMs - 4_000);

    // Assert: up before; off air at once after the restart (never stuck on its last sponsor);
    // and taken again at 11:10, so the trigger is not blocked for good.
    expect(isOnAirBeforeTheRestart, 'the roll was on air before the restart').toBe(true);
    expect(
      isOnAirRightAfterTheRestart,
      'the boot takes a roll whose auto-out was lost off air',
    ).toBe(false);
    expect(readFiringTimesOfDay(storeAfterTheRestart), 'the next moment fires').toEqual(['11:10']);
    expect(
      readDataOnAirOnLayer(storeAfterTheRestart, 'sponsor-roll-plain'),
      'and the roll is on air again',
    ).toBeDefined();
  });
});
