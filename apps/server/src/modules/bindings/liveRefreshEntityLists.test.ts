/**
 * An edit in Cadastros reaches a whole list on air (apps/server)
 *
 * What this module is for:
 *   A field of kind `entityList` (BAJAOVRLAY-46) reads every sponsor, or every slot of the
 *   schedule, and is always live like an entity reference: an edit, add or delete of any
 *   record of that kind rewrites every instance on air or in preview that holds the list,
 *   through refreshBoundInstanceData as `sistema:vinculos`. The list is kept on the
 *   instance's instanceBindings entry at the take, beside the entity references.
 *
 * What these tests prove (through a real store, the refresher run by hand, a stand-in
 * board with a sponsors list and an optional slots list):
 *   - A sponsor's edit (Certi moved up to Diamante) reorders the list on air at once.
 *   - Adding a sponsor puts it on air in its place in the round.
 *   - Deleting a slot of the schedule takes it off the board on air.
 *   - Deleting the last slot empties the optional list: it leaves the air (no slot left
 *     to show), while the required sponsors stay.
 *   - Deleting the last sponsor of the required list keeps the last good list on air
 *     (nothing on air is blanked, rule 4).
 *
 * What these tests deliberately do not cover:
 *   - Reading the list; entityListResolution.test.ts in shared.
 *   - Entity references to one record; liveRefreshEntities.test.ts.
 */
import { buildFakeMediaId } from '@bajaovrlay/shared/fakeMediaIds.testSupport';
import { describe, expect, it } from 'vitest';

import { createGraphicsFolderWithBuiltPackage } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { mediaStoreActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  openStoreWithTheRefresher,
  operatorActor,
  readInstanceOn,
} from './liveRefresh.testSupport.js';

/** The media ids of the logos below. */
const logoMediaIds = {
  bosch: buildFakeMediaId(8),
  certi: buildFakeMediaId(10),
  sae: buildFakeMediaId(9),
};

/**
 * A board with a required list of sponsors and an optional list of slots: a stand-in
 * with only what these tests read, built into a graphics folder as the server finds one.
 */
function buildBoardWithListsManifest() {
  return {
    $schema: 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json',
    id: 'baja-board-with-lists',
    version: '0.1.0',
    name: 'Quadro com listas',
    main: 'board-with-lists.js',
    supportsRealTime: true,
    supportsNonRealTime: false,
    v_baja: { defaultLayerId: 'fullscreen', category: 'other' },
    schema: {
      type: 'object',
      properties: {
        sponsors: {
          type: 'array',
          title: 'Patrocinadores',
          items: { type: 'object', required: ['name', 'level', 'logoUrl'] },
        },
        slots: {
          type: 'array',
          title: 'Sessões',
          items: { type: 'object', required: ['slotId', 'sessionName', 'startsAtMs'] },
        },
      },
      required: ['sponsors'],
    },
  };
}

/** Bosch at Diamante, Certi at Ouro: the sponsors saved before the board is taken. */
function buildBoschAndCerti() {
  return [
    {
      sponsorId: 'bosch',
      name: 'Bosch',
      tier: 'diamante',
      rollWeight: 10,
      logoMediaId: logoMediaIds.bosch,
    },
    {
      sponsorId: 'certi',
      name: 'Certi',
      tier: 'ouro',
      rollWeight: 4,
      logoMediaId: logoMediaIds.certi,
    },
  ];
}

/** Sunday's briefing and enduro. */
function buildBriefingAndEnduro() {
  return [
    {
      slotId: 'briefing',
      sessionName: 'Briefing das equipes',
      sessionKind: 'other',
      startsAtMs: Date.parse('2025-03-30T11:30:00.000Z'),
    },
    {
      slotId: 'enduro',
      sessionName: 'Enduro de Resistência',
      sessionKind: 'enduro',
      startsAtMs: Date.parse('2025-03-30T13:00:00.000Z'),
    },
  ];
}

/** Records the three logos in the media store, as the upload route does before a sponsor names one. */
function recordTheThreeLogos(stateStore: StateStore): void {
  for (const [sponsorKey, mediaId] of Object.entries(logoMediaIds)) {
    applyOrThrow(
      stateStore,
      {
        type: 'recordUploadedMedia',
        media: {
          mediaId,
          fileName: `logo-${sponsorKey}.webp`,
          contentType: 'image/webp',
          sizeBytes: 21_480,
          widthPx: 480,
          heightPx: 138,
        },
      },
      mediaStoreActor,
    );
  }
}

/**
 * A store with the refresher, the three logos, Bosch, Certi and two slots saved, and the board reading both
 * lists taken on air.
 */
function openStoreWithTheBoardOnAir() {
  const opened = openStoreWithTheRefresher(
    createGraphicsFolderWithBuiltPackage('board-with-lists', buildBoardWithListsManifest()),
  );
  const { stateStore } = opened;
  recordTheThreeLogos(stateStore);
  applyOrThrow(stateStore, {
    type: 'importEntities',
    entityType: 'sponsor',
    records: buildBoschAndCerti(),
  });
  applyOrThrow(stateStore, {
    type: 'importEntities',
    entityType: 'scheduleSlot',
    records: buildBriefingAndEnduro(),
  });
  const outcome = stateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'board-with-lists',
      layerId: 'fullscreen',
      label: 'Quadro do intervalo',
      fields: {
        sponsors: { kind: 'entityList', entityType: 'sponsor' },
        slots: { kind: 'entityList', entityType: 'scheduleSlot' },
      },
    },
    operatorActor,
  );
  if (!outcome.ok || outcome.createdItemId === undefined) {
    throw new Error(`createItem was refused: ${JSON.stringify(outcome)}`);
  }
  applyOrThrow(stateStore, { type: 'takeItem', itemId: outcome.createdItemId });
  return opened;
}

/** The names of the sponsors on air, in order. */
function readSponsorNamesOnAir(stateStore: StateStore): unknown {
  const sponsors = readInstanceOn(stateStore, 'fullscreen', 'program')?.resolvedData.sponsors;
  return Array.isArray(sponsors)
    ? sponsors.map((sponsor) => (sponsor as { name: string }).name)
    : sponsors;
}

/** The ids of the slots on air, in order; undefined when the list is not on air. */
function readSlotIdsOnAir(stateStore: StateStore): unknown {
  const slots = readInstanceOn(stateStore, 'fullscreen', 'program')?.resolvedData.slots;
  return Array.isArray(slots) ? slots.map((slot) => (slot as { slotId: string }).slotId) : slots;
}

describe('an entity list on air, refreshed by an edit in Cadastros', () => {
  it('reorders the sponsors on air when one moves up a level', () => {
    // Arrange: the board on air, Bosch before Certi.
    const { stateStore, refreshTimer } = openStoreWithTheBoardOnAir();
    const namesBefore = readSponsorNamesOnAir(stateStore);

    // Act: move Certi up to Diamante with a heavier weight, and let the refresher run.
    applyOrThrow(stateStore, {
      type: 'upsertEntity',
      entityType: 'sponsor',
      record: { ...buildBoschAndCerti()[1], tier: 'diamante', rollWeight: 10 },
    });
    refreshTimer.runThePendingRefresh();

    // Assert: Bosch and Certi now both Diamante at weight 10, so by name: Bosch, Certi;
    // and Certi's level on air is Diamante.
    const sponsorsOnAir = readInstanceOn(stateStore, 'fullscreen', 'program')?.resolvedData
      .sponsors as Array<{ name: string; level: string }>;
    expect(namesBefore, 'the take read both sponsors').toEqual(['Bosch', 'Certi']);
    expect(
      sponsorsOnAir.map((sponsor) => sponsor.level),
      'the edit reaches the air',
    ).toEqual(['diamante', 'diamante']);
  });

  it('puts a new sponsor on air in its place in the round', () => {
    // Arrange: the board on air.
    const { stateStore, refreshTimer } = openStoreWithTheBoardOnAir();

    // Act: add SAE Brasil, the organiser, and let the refresher run.
    applyOrThrow(stateStore, {
      type: 'upsertEntity',
      entityType: 'sponsor',
      record: {
        sponsorId: 'sae',
        name: 'SAE Brasil',
        tier: 'realizacao',
        rollWeight: 5,
        logoMediaId: logoMediaIds.sae,
      },
    });
    refreshTimer.runThePendingRefresh();

    // Assert: the organiser last.
    expect(readSponsorNamesOnAir(stateStore), 'the new sponsor joins the round').toEqual([
      'Bosch',
      'Certi',
      'SAE Brasil',
    ]);
  });

  it('takes a deleted slot off the board on air', () => {
    // Arrange: the board on air with the briefing and the enduro.
    const { stateStore, refreshTimer } = openStoreWithTheBoardOnAir();

    // Act: delete the briefing, and let the refresher run.
    applyOrThrow(stateStore, {
      type: 'deleteEntity',
      entityType: 'scheduleSlot',
      slotId: 'briefing',
    });
    refreshTimer.runThePendingRefresh();

    // Assert: the enduro alone.
    expect(readSlotIdsOnAir(stateStore), 'the delete reaches the air').toEqual(['enduro']);
  });

  it('takes the optional list off the air when its last slot is deleted', () => {
    // Arrange: the board on air with two slots.
    const { stateStore, refreshTimer } = openStoreWithTheBoardOnAir();

    // Act: delete both slots, and let the refresher run.
    applyOrThrow(stateStore, {
      type: 'deleteEntity',
      entityType: 'scheduleSlot',
      slotId: 'briefing',
    });
    applyOrThrow(stateStore, {
      type: 'deleteEntity',
      entityType: 'scheduleSlot',
      slotId: 'enduro',
    });
    refreshTimer.runThePendingRefresh();

    // Assert: no slots key on air; the sponsors untouched.
    expect(readSlotIdsOnAir(stateStore), 'an empty optional list leaves the air').toBeUndefined();
    expect(readSponsorNamesOnAir(stateStore), 'the sponsors stay').toEqual(['Bosch', 'Certi']);
  });

  it('keeps the last sponsors on air when the required list is emptied', () => {
    // Arrange: the board on air with Bosch and Certi.
    const { stateStore, refreshTimer } = openStoreWithTheBoardOnAir();

    // Act: delete both sponsors, and let the refresher run.
    applyOrThrow(stateStore, { type: 'deleteEntity', entityType: 'sponsor', sponsorId: 'bosch' });
    applyOrThrow(stateStore, { type: 'deleteEntity', entityType: 'sponsor', sponsorId: 'certi' });
    refreshTimer.runThePendingRefresh();

    // Assert: nothing blanked on air.
    expect(readSponsorNamesOnAir(stateStore), 'the last good list stays on air').toEqual([
      'Bosch',
      'Certi',
    ]);
  });
});
