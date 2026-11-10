/**
 * The plain sponsor roll leaves when its pass ends (apps/server)
 *
 * What this module is for:
 *   The plain sponsor roll (BAJAOVRLAY-64) shows each sponsor once and leaves by itself. Its
 *   manifest names the auto-out rule `onePlainSponsorRollPass`, so a take works out from the
 *   sponsors it puts on air how long the pass lasts, with shared's
 *   measurePlainSponsorRollPassMs, and writes it on the new instance as its auto-out. The
 *   graphic turns its sponsors on the same table (shared's sponsorRollPass.ts), so the layer
 *   is free again exactly when the last sponsor's hold ends.
 *
 * What these tests prove (a real store on a temporary SQLite file, the real manifest, fake
 * timers):
 *   - A take writes the pass's length on the instance: the entrance and each sponsor's hold.
 *   - That length is shared's own measure of the sponsors on air: the test fails if the
 *     server worked it out any other way than the graphic does.
 *   - The auto-out clears the layer exactly then, not a millisecond before, as
 *     `sistema:auto-out`.
 *   - A sponsor with no logo adds no time.
 *   - A sponsor list changed while the roll is on air neither extends nor cuts the pass.
 *   - A preview carries the pass too, and "Tomar" sends it to air with it.
 *   - A take whose sponsors have no logo at all is refused in pt-BR, before anything leaves
 *     the layer: the roll would show nothing and clear the layer for nothing.
 *
 * What these tests deliberately do not cover:
 *   - The table and the plan; shared's sponsorRollPass.test.ts.
 *   - The graphic's own moments; the sponsor-roll-plain package's tests.
 *   - Auto-out in general; autoOut.test.ts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { measurePlainSponsorRollPassMs } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { autoOutActor, startAutoOutScheduler } from './autoOut.js';
import { createGraphicsFolderWithBuiltPackage } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import { createItemOnTheStore } from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';

/** The real manifest of the plain sponsor roll, as `pnpm build` copies it into dist/. */
const plainSponsorRollManifest: object = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../../../../packages/graphics/sponsor-roll-plain/sponsor-roll-plain.ograf.json',
        import.meta.url,
      ),
    ),
    'utf8',
  ),
);

/** Bosch (Diamante), Petrobras (Ouro) and SAE Brasil (Realização), each with a logo. */
function buildThreeSponsorsWithLogos() {
  return [
    { name: 'Bosch', level: 'diamante', logoUrl: '/media/logo-bosch.png', logoOnLightPlate: false },
    {
      name: 'Petrobras',
      level: 'ouro',
      logoUrl: '/media/logo-petrobras.png',
      logoOnLightPlate: true,
    },
    {
      name: 'SAE Brasil',
      level: 'realizacao',
      logoUrl: '/media/logo-sae.png',
      logoOnLightPlate: false,
    },
  ];
}

/**
 * Builds a store on a fresh database with the plain roll registered and the auto-out
 * scheduler running, fake timers on; the item "Patrocinadores (simples)" holds the given
 * sponsors typed as a list.
 */
function startStoreWithThePlainRollItem(sponsors: object[]) {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const { database } = openTemporaryDatabase();
  const store: StateStore = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltPackage(
      'sponsor-roll-plain',
      plainSponsorRollManifest,
    ),
  });
  const itemId = createItemOnTheStore(store, {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'sponsor-roll-plain',
    layerId: 'sponsor-roll-plain',
    label: 'Patrocinadores (simples)',
    fields: {
      sponsors: { kind: 'literal', value: sponsors },
      corner: { kind: 'literal', value: 'top-left' },
    },
  });
  const scheduler = startAutoOutScheduler({
    stateStore: store,
    logger: createLogger({ level: 'silent' }),
  });
  onTestFinished(() => scheduler.stop());
  return { store, itemId };
}

/** Sends a command as the operator and fails the test at once if it is refused. */
function applyOrThrow(store: StateStore, command: Record<string, unknown>): void {
  const outcome = store.applyCommand(command, operatorActor);
  if (!outcome.ok) {
    throw new Error(`The step ${String(command.type)} was refused: ${outcome.error.message}`);
  }
}

/** The roll's instance on its layer's program output, or undefined when it is off air. */
function findRollOnAir(store: StateStore) {
  return store
    .readAllSlices()
    .instances.find(
      (instance) => instance.layerId === 'sponsor-roll-plain' && instance.target === 'program',
    );
}

describe('a take of the plain sponsor roll', () => {
  it('writes the pass’s length on the instance: the entrance and each sponsor’s hold', () => {
    // Arrange: the roll with Bosch, Petrobras and SAE Brasil.
    const { store, itemId } = startStoreWithThePlainRollItem(buildThreeSponsorsWithLogos());

    // Act: take it.
    applyOrThrow(store, { type: 'takeItem', itemId });

    // Assert: 0,4 s in, then 8 s, 5 s and 5 s.
    expect(findRollOnAir(store)?.autoOutAfterMs, 'the pass lasts 18,4 s').toBe(18_400);
  });

  it('works the length out with shared’s measure of the sponsors on air, as the graphic does', () => {
    // Arrange: the roll with Bosch, Petrobras and SAE Brasil.
    const { store, itemId } = startStoreWithThePlainRollItem(buildThreeSponsorsWithLogos());

    // Act: take it, and measure the pass of exactly what went on air.
    applyOrThrow(store, { type: 'takeItem', itemId });
    const rollOnAir = findRollOnAir(store);
    const sponsorsOnAir = rollOnAir?.resolvedData.sponsors as Parameters<
      typeof measurePlainSponsorRollPassMs
    >[0];

    // Assert: the server's auto-out is the one table's pass, never a number of its own.
    expect(rollOnAir?.autoOutAfterMs, 'the auto-out must be shared’s pass of the list').toBe(
      measurePlainSponsorRollPassMs(sponsorsOnAir),
    );
  });

  it('clears the layer exactly when the pass ends, as sistema:auto-out', () => {
    // Arrange: the roll taken.
    const { store, itemId } = startStoreWithThePlainRollItem(buildThreeSponsorsWithLogos());
    applyOrThrow(store, { type: 'takeItem', itemId });

    // Act: time runs to a millisecond before the end, then to the end.
    vi.advanceTimersByTime(18_399);
    const isOnAirJustBefore = findRollOnAir(store) !== undefined;
    vi.advanceTimersByTime(1);

    // Assert: still up a millisecond before, gone at the end, cleared by the auto-out.
    expect(isOnAirJustBefore, 'the last sponsor must not be cut short').toBe(true);
    expect(findRollOnAir(store), 'the layer must be free when the pass ends').toBeUndefined();
    expect(store.readAllSlices().eventLog.at(-1)?.actor, 'the auto-out cleared it').toBe(
      autoOutActor,
    );
  });

  it('adds no time for a sponsor with no logo', () => {
    // Arrange: Bosch with a logo, and Randon, typed with no logo yet.
    const randonWithoutALogo = { name: 'Randon', level: 'prata', logoOnLightPlate: false };
    const bosch = {
      name: 'Bosch',
      level: 'diamante',
      logoUrl: '/media/logo-bosch.png',
      logoOnLightPlate: false,
    };
    const sponsors = [bosch, randonWithoutALogo];
    const { store, itemId } = startStoreWithThePlainRollItem(sponsors);

    // Act: take it.
    applyOrThrow(store, { type: 'takeItem', itemId });

    // Assert: Bosch's 8 s and the entrance, nothing for Randon.
    expect(findRollOnAir(store)?.autoOutAfterMs, 'Randon is skipped, so adds nothing').toBe(8_400);
  });

  it('neither extends nor cuts the pass when the list changes on air', () => {
    // Arrange: the roll taken with three sponsors; 10 s into its 18,4 s pass.
    const { store, itemId } = startStoreWithThePlainRollItem(buildThreeSponsorsWithLogos());
    applyOrThrow(store, { type: 'takeItem', itemId });
    vi.advanceTimersByTime(10_000);

    // Act: "Atualizar no ar" with a fourth sponsor, a Diamante worth 8 s more.
    const fiat = { name: 'Fiat', level: 'diamante', logoUrl: '/media/logo-fiat.png' };
    applyOrThrow(store, {
      type: 'updateInstanceData',
      instanceId: findRollOnAir(store)?.id ?? '',
      data: { sponsors: [...buildThreeSponsorsWithLogos(), fiat] },
    });
    vi.advanceTimersByTime(8_400);

    // Assert: the layer is free at 18,4 s, as the take worked out.
    expect(findRollOnAir(store), 'the pass taken is the pass that ends').toBeUndefined();
  });

  it('carries the pass from a preview to the air with "Tomar"', () => {
    // Arrange: the roll previewed.
    const { store, itemId } = startStoreWithThePlainRollItem(buildThreeSponsorsWithLogos());
    applyOrThrow(store, { type: 'previewItem', itemId, origin: 'manual' });

    // Act: "Tomar" sends the preview to air.
    applyOrThrow(store, { type: 'takePreview', layerId: 'sponsor-roll-plain' });

    // Assert: on air with the same pass.
    expect(findRollOnAir(store)?.autoOutAfterMs, 'the preview’s pass goes to air').toBe(18_400);
  });

  it('refuses a take whose sponsors have no logo at all, in pt-BR, leaving the layer as it was', () => {
    // Arrange: the roll typed with Randon and Fras-le, neither with a logo yet.
    const { store, itemId } = startStoreWithThePlainRollItem([
      { name: 'Randon', level: 'prata', logoOnLightPlate: false },
      { name: 'Fras-le', level: 'apoio', logoUrl: '', logoOnLightPlate: false },
    ]);

    // Act: take it.
    const outcome = store.applyCommand({ type: 'takeItem', itemId }, operatorActor);

    // Assert: refused, saying why, and nothing on the layer.
    expect(outcome, 'a roll with nothing to show is refused, saying why').toEqual({
      ok: false,
      error: {
        code: 'NOTHING_TO_SHOW',
        message:
          'O gráfico "sponsor-roll-plain" não tem o que mostrar: nenhum patrocinador da lista tem logo.',
      },
    });
    expect(findRollOnAir(store), 'nothing goes on air').toBeUndefined();
  });
});
