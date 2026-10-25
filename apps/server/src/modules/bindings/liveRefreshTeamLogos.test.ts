/**
 * The podium's logos come from Cadastros, at the take and after a team edit (apps/server)
 *
 * What this module is for:
 *   The podium binds the positions with two transforms: topN (the first three cars), then
 *   withTeamLogos, which adds each car's team logo from the entity library
 *   (BAJAOVRLAY-47). withTeamLogos reads the teams the resolver hands it, so the server
 *   must hand it the library as it is at the take, at a preview and at every live refresh;
 *   and since a team edit changes what it gives, a team edit must refresh the instances
 *   whose live bindings use it, through the same refresher a source's new data uses.
 *
 * What these tests prove (through a real store on a temporary database, the refresher
 *   run by hand):
 *   - The take puts the three cars on air with the logo of the team that has one, its
 *     plate flag beside it, and no logo on the cars whose team has none.
 *   - A preview reads the library the same way.
 *   - Uploading a logo for a team and saving it in Cadastros refreshes a live podium on
 *     air: the car gains its logo, with no new poll of the source.
 *   - A podium frozen at the take ("Congelado na entrada") keeps what it took: a team
 *     edit does not reach it, as a new poll would not.
 *
 * What these tests deliberately do not cover:
 *   - What withTeamLogos adds to each entry; withTeamLogosTransform.test.ts in shared.
 *   - Drawing the logos; the podium package's own tests.
 *   - The real podium manifest: the stand-in below says only what the server reads (a
 *     list field whose entries may carry more keys); the podium's manifest–data agreement
 *     test checks the real one takes the positions with logos.
 */
import type { MediaRecord, PositionsShape } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createGraphicsFolderWithBuiltPackage } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor, mediaStoreActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  enduroSimulatorId,
  momentOfTheCommandsMs,
  openStoreWithTheRefresher,
  operatorActor,
  readInstanceOn,
} from './liveRefresh.testSupport.js';

/** The SHA-256 media id of Acauã Baja's logo, as the upload route names the file. */
const logoOfAcauaBajaMediaId = '9e1d3c5b7a9f1e3d5c7b9a1f3e5d7c9b1a3f5e7d9c1b3a5f7e9d1c3b5a7f9e1d';
/** The media id of Coruja Racing's logo, uploaded during the race. */
const logoOfCorujaRacingMediaId =
  '2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d';

/**
 * A stand-in for the podium's manifest, with what the server reads: a fullscreen graphic
 * whose `entries` is a list of cars (each with at least its number, team and school) and
 * an optional title. The entries allow more keys, as the real podium's do, so the logo
 * fields withTeamLogos adds are accepted.
 */
function buildPodiumManifestAsTheServerReadsIt() {
  return {
    id: 'baja-podium',
    name: 'Pódio',
    main: 'podium.js',
    version: '0.1.0',
    supportsRealTime: true,
    supportsNonRealTime: false,
    stepCount: 3,
    v_baja: { defaultLayerId: 'fullscreen' },
    schema: {
      type: 'object',
      properties: {
        headTitle: { type: 'string', title: 'Título do pódio' },
        entries: {
          type: 'array',
          title: 'Carros do pódio',
          items: {
            type: 'object',
            properties: {
              carNumber: { type: 'integer' },
              teamName: { type: 'string' },
              schoolName: { type: 'string' },
            },
            required: ['carNumber', 'teamName', 'schoolName'],
          },
        },
      },
      required: ['entries'],
      additionalProperties: false,
    },
  };
}

/** The enduro's first four cars as the simulator sends them: 31, 38, 25 and 78. */
function buildPositionsOfTheEnduro(): PositionsShape {
  return {
    sessionId: 'enduro-2027-nacional',
    updatedAtMs: momentOfTheCommandsMs,
    entries: [
      {
        position: 1,
        carNumber: 31,
        teamName: 'Acauã Baja',
        schoolName: 'Mauá',
        laps: 34,
        status: 'running',
      },
      {
        position: 2,
        carNumber: 38,
        teamName: 'Coruja Racing',
        schoolName: 'EESC-USP',
        laps: 34,
        status: 'running',
      },
      {
        position: 3,
        carNumber: 25,
        teamName: 'Bem-te-vi Off-Road',
        schoolName: 'UFES',
        laps: 33,
        status: 'running',
      },
      {
        position: 4,
        carNumber: 78,
        teamName: 'Arara Off-Road',
        schoolName: 'UNIFEI',
        laps: 33,
        status: 'running',
      },
    ],
  };
}

/** How the media store lists an uploaded logo. */
function buildUploadedLogo(mediaId: string, fileName: string): Omit<MediaRecord, 'uploadedAt'> {
  return {
    mediaId,
    fileName,
    contentType: 'image/png',
    sizeBytes: 18_204,
    widthPx: 480,
    heightPx: 224,
  };
}

/**
 * A store with the podium built and the refresher on: Acauã Baja (car 31) and Coruja
 * Racing (car 38) in Cadastros, only Acauã Baja with a logo (a dark one, on the light
 * plate), the simulator's positions polled, and a podium item whose cars read the
 * positions through topN 3 then withTeamLogos, live or frozen as asked.
 */
function openStoreWithThePodiumItem(isLive: boolean) {
  const opened = openStoreWithTheRefresher(
    createGraphicsFolderWithBuiltPackage('podium', buildPodiumManifestAsTheServerReadsIt()),
  );
  const { stateStore } = opened;
  applyOrThrow(
    stateStore,
    {
      type: 'recordUploadedMedia',
      media: buildUploadedLogo(logoOfAcauaBajaMediaId, 'logo-acaua.png'),
    },
    mediaStoreActor,
  );
  applyOrThrow(stateStore, {
    type: 'upsertEntity',
    entityType: 'team',
    record: {
      carNumber: 31,
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      logoMediaId: logoOfAcauaBajaMediaId,
      logoOnLightPlate: true,
    },
  });
  applyOrThrow(stateStore, {
    type: 'upsertEntity',
    entityType: 'team',
    record: { carNumber: 38, teamName: 'Coruja Racing', schoolName: 'EESC-USP' },
  });
  pollTheSimulatorWithPositions(stateStore, buildPositionsOfTheEnduro());
  const podiumItemId = createPodiumItem(stateStore, isLive);
  return { ...opened, podiumItemId };
}

/** Records one good poll of the simulator carrying the positions given, as its poller. */
function pollTheSimulatorWithPositions(stateStore: StateStore, positions: PositionsShape): void {
  applyOrThrow(
    stateStore,
    {
      type: 'recordDataSourcePoll',
      sourceId: enduroSimulatorId,
      result: { ok: true, shapes: { positions }, receivedAtMs: positions.updatedAtMs },
    },
    buildDataSourcePollerActor(enduroSimulatorId),
  );
}

/** Creates the podium item of the brief's recipe and answers its id. */
function createPodiumItem(stateStore: StateStore, isLive: boolean): string {
  const outcome = stateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'podium',
      layerId: 'fullscreen',
      label: 'Pódio do enduro',
      fields: {
        headTitle: { kind: 'literal', value: 'PÓDIO' },
        entries: {
          kind: 'binding',
          sourceId: enduroSimulatorId,
          shapeKey: 'positions',
          path: 'entries',
          isLive,
          transformId: 'topN',
          transformParameters: { n: 3 },
          thenTransformId: 'withTeamLogos',
        },
      },
    },
    operatorActor,
  );
  if (!outcome.ok || outcome.createdItemId === undefined) {
    throw new Error(`createItem was refused: ${JSON.stringify(outcome)}`);
  }
  return outcome.createdItemId;
}

/** Each car's number and logo fields as an instance on this output shows them. */
function readCarsAndLogosOn(stateStore: StateStore, target: string) {
  const entries = readInstanceOn(stateStore, 'fullscreen', target)?.resolvedData.entries as
    Array<{ carNumber: number; logoUrl?: string; logoOnLightPlate?: boolean }> | undefined;
  return (entries ?? []).map((entry) => ({
    carNumber: entry.carNumber,
    logoUrl: entry.logoUrl,
    logoOnLightPlate: entry.logoOnLightPlate,
  }));
}

/** What the podium shows before any edit: car 31 crowned, 38 and 25 without a logo. */
const carsAndLogosBeforeTheEdit = [
  { carNumber: 31, logoUrl: `/media/${logoOfAcauaBajaMediaId}`, logoOnLightPlate: true },
  { carNumber: 38, logoUrl: undefined, logoOnLightPlate: undefined },
  { carNumber: 25, logoUrl: undefined, logoOnLightPlate: undefined },
];

/** Uploads Coruja Racing's logo and saves it on car 38's team, as Cadastros does. */
function giveCorujaRacingItsLogo(stateStore: StateStore): void {
  applyOrThrow(
    stateStore,
    {
      type: 'recordUploadedMedia',
      media: buildUploadedLogo(logoOfCorujaRacingMediaId, 'logo-coruja.png'),
    },
    mediaStoreActor,
  );
  applyOrThrow(stateStore, {
    type: 'upsertEntity',
    entityType: 'team',
    record: {
      carNumber: 38,
      teamName: 'Coruja Racing',
      schoolName: 'EESC-USP',
      logoMediaId: logoOfCorujaRacingMediaId,
    },
  });
}

describe('the podium’s logos through the store', () => {
  it('puts the first three cars on air at the take, each with its team’s logo if it has one', () => {
    // Arrange: the podium item, frozen at the take as the recipe says.
    const { stateStore, podiumItemId } = openStoreWithThePodiumItem(false);

    // Act: take it.
    applyOrThrow(stateStore, { type: 'takeItem', itemId: podiumItemId });

    // Assert: cars 31, 38 and 25; only car 31 crowned, with its plate flag.
    expect(
      readCarsAndLogosOn(stateStore, 'program'),
      'the take must hand withTeamLogos the library',
    ).toEqual(carsAndLogosBeforeTheEdit);
  });

  it('reads the library for a preview too', () => {
    // Arrange: the podium item, frozen at the take.
    const { stateStore, podiumItemId } = openStoreWithThePodiumItem(false);

    // Act: put it in preview.
    applyOrThrow(stateStore, { type: 'previewItem', itemId: podiumItemId, origin: 'manual' });

    // Assert: the preview shows the same logos the take would.
    expect(
      readCarsAndLogosOn(stateStore, 'preview'),
      'a preview must hand withTeamLogos the library',
    ).toEqual(carsAndLogosBeforeTheEdit);
  });

  it('crowns a car on a live podium on air when its team gets a logo in Cadastros', () => {
    // Arrange: a live podium on air, car 38's team still without a logo.
    const { stateStore, refreshTimer, podiumItemId } = openStoreWithThePodiumItem(true);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: podiumItemId });

    // Act: upload Coruja Racing's logo and save it on the team, then let the refresher
    // run. The source sends nothing new.
    giveCorujaRacingItsLogo(stateStore);
    refreshTimer.runThePendingRefresh();

    // Assert: car 38 now carries its logo, with the plate off; 31 and 25 as they were.
    expect(
      readCarsAndLogosOn(stateStore, 'program'),
      'a team edit must refresh the bindings that use withTeamLogos',
    ).toEqual([
      carsAndLogosBeforeTheEdit[0],
      { carNumber: 38, logoUrl: `/media/${logoOfCorujaRacingMediaId}`, logoOnLightPlate: false },
      carsAndLogosBeforeTheEdit[2],
    ]);
  });

  it('leaves a podium frozen at the take as it took it', () => {
    // Arrange: a frozen podium on air.
    const { stateStore, refreshTimer, podiumItemId } = openStoreWithThePodiumItem(false);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: podiumItemId });

    // Act: give car 38's team its logo and let the refresher run.
    giveCorujaRacingItsLogo(stateStore);
    refreshTimer.runThePendingRefresh();

    // Assert: what the take showed, unchanged: frozen means frozen, for logos too.
    expect(
      readCarsAndLogosOn(stateStore, 'program'),
      'a frozen podium must not follow the library',
    ).toEqual(carsAndLogosBeforeTheEdit);
  });
});
