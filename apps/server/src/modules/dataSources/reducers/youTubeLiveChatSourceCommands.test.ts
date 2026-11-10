/**
 * The YouTube live chat source's commands (apps/server)
 *
 * What this module is for:
 *   A YouTube source (BAJAOVRLAY-35) is made and edited like any other ("+ Fonte",
 *   "Editar"): its config is the live's address only. Its poll interval has a floor of
 *   10 s, because each read spends 5 of the key's daily quota units. Each poll result
 *   carries the units spent today, which the store keeps on the source's status.
 *
 * What these tests prove:
 *   - "+ Fonte" stores the address and nothing else, off.
 *   - An address that is not a live's is refused at config.liveAddress.
 *   - An interval under 10 s is refused at creation and at "Editar", in pt-BR; 10 s is taken.
 *   - A good or failed poll leaves the quota on the status; a repeat poll whose units moved
 *     changes the status only and writes no event-log row.
 *
 * What these tests deliberately do not cover:
 *   - Reading YouTube: adapters/youtubeLiveChat/*.test.ts.
 *   - The page's form: the control page's tests.
 */
import type { DataSnapshot, YouTubeLiveChatDataSource } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildRaceDaySlicesWithDataSources,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

/** "YouTube — Enduro ao vivo", on and healthy, 6 units spent today. */
function buildHealthyYouTubeSource(): YouTubeLiveChatDataSource {
  return {
    id: 'youtube-enduro',
    label: 'YouTube — Enduro ao vivo',
    kind: 'youtubeLiveChat',
    config: { liveAddress: 'https://youtu.be/BajaLive024' },
    pollIntervalMs: 30_000,
    isEnabled: true,
    isRecording: false,
    status: {
      lastAttemptAtMs: momentOfTheCommandMs - 30_000,
      lastOkAtMs: momentOfTheCommandMs - 30_000,
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 90_000,
      recordingError: null,
      youTubeQuota: { unitsSpentToday: 6, dailyUnitsBudget: 9_000 },
    },
  };
}

/** The snapshot of that source: one Super Chat, Torcida Carnaúba's R$ 50,00. */
function buildSnapshotWithCarnaubasSuperChat(): DataSnapshot {
  return {
    sourceId: 'youtube-enduro',
    receivedAtMs: momentOfTheCommandMs - 30_000,
    shapes: {
      superChats: {
        updatedAtMs: momentOfTheCommandMs - 30_000,
        entries: [
          {
            messageId: 'mensagem-carnauba-0001',
            authorName: 'Torcida Carnaúba Baja',
            amountText: 'R$ 50,00',
            amountMicros: 50_000_000,
            currency: 'BRL',
            tier: 4,
            messageText: 'Força, Carnaúba! Mossoró está com vocês',
            publishedAtMs: momentOfTheCommandMs - 45_000,
          },
        ],
      },
    },
  };
}

describe('making and editing a YouTube source', () => {
  it('stores the live address and nothing else, off', () => {
    // Arrange: no source yet.
    const slicesBefore = buildRaceDaySlicesWithDataSources({ dataSources: [] });

    // Act: "+ Fonte" with the live's address, read every 30 s.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'YouTube — Enduro ao vivo',
        kind: 'youtubeLiveChat',
        config: { liveAddress: ' https://www.youtube.com/live/BajaLive024 ' },
        pollIntervalMs: 30_000,
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: one source, off, holding the trimmed address only.
    const sourcesAfter = outcome.status === 'applied' ? outcome.slices.dataSources : [];
    expect(sourcesAfter, 'the new YouTube source must be stored off').toMatchObject([
      {
        kind: 'youtubeLiveChat',
        config: { liveAddress: 'https://www.youtube.com/live/BajaLive024' },
        pollIntervalMs: 30_000,
        isEnabled: false,
      },
    ]);
  });

  it('refuses an address that is not a live, naming the field', () => {
    // Arrange: no source yet.
    const slicesBefore = buildRaceDaySlicesWithDataSources({ dataSources: [] });

    // Act: "+ Fonte" with the channel's page instead of the live's.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'YouTube — Canal',
        kind: 'youtubeLiveChat',
        config: { liveAddress: 'https://www.youtube.com/@BajaSAEBrasil' },
        pollIntervalMs: 30_000,
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused at config.liveAddress.
    expect(outcome, 'a channel page must be refused at the address').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_DATA_SOURCE_CONFIG',
        message: expect.stringContaining('config.liveAddress') as unknown,
      },
    });
  });

  const intervalScenarios = [
    // Faster than the floor: the quota would run out by early afternoon.
    { name: 'refuses 5 s at creation', pollIntervalMs: 5_000, isRefused: true },
    // The floor itself is allowed.
    { name: 'takes 10 s at creation', pollIntervalMs: 10_000, isRefused: false },
  ];

  it.each(intervalScenarios)('$name', ({ pollIntervalMs, isRefused }) => {
    // Arrange: no source yet.
    const slicesBefore = buildRaceDaySlicesWithDataSources({ dataSources: [] });

    // Act: "+ Fonte" with the interval in the row.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'YouTube — Enduro ao vivo',
        kind: 'youtubeLiveChat',
        config: { liveAddress: 'https://youtu.be/BajaLive024' },
        pollIntervalMs,
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused with the pt-BR floor, or taken.
    if (isRefused) {
      expect(outcome, 'an interval under 10 s must be refused').toEqual({
        status: 'refused',
        error: {
          code: 'INVALID_DATA_SOURCE_CONFIG',
          message: 'O chat do YouTube é lido no máximo a cada 10 s, para não gastar a cota diária.',
        },
      });
    } else {
      expect(outcome.status, 'an interval of 10 s must be taken').toBe('applied');
    }
  });

  it('refuses an interval under 10 s at "Editar"', () => {
    // Arrange: the healthy YouTube source.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyYouTubeSource()],
    });

    // Act: "Editar" to read every 2 s.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'updateDataSource', sourceId: 'youtube-enduro', pollIntervalMs: 2_000 },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused, the source as it was.
    expect(outcome.status, 'an edit under 10 s must be refused').toBe('refused');
  });
});

describe('the quota on the status', () => {
  it('keeps the quota a failed poll carries', () => {
    // Arrange: the healthy source at 6 units.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyYouTubeSource()],
      dataSnapshots: [buildSnapshotWithCarnaubasSuperChat()],
    });

    // Act: a poll that failed after spending 5 more units.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'recordDataSourcePoll',
        sourceId: 'youtube-enduro',
        result: {
          ok: false,
          error: 'O chat ao vivo está desativado nesta transmissão.',
          attemptedAtMs: momentOfTheCommandMs,
          youTubeQuota: { unitsSpentToday: 11, dailyUnitsBudget: 9_000 },
        },
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: stale with the reason, and 11 units shown.
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    expect(sourceAfter?.status, 'the failed poll must show the reason and the units').toMatchObject(
      {
        isStale: true,
        lastError: 'O chat ao vivo está desativado nesta transmissão.',
        youTubeQuota: { unitsSpentToday: 11, dailyUnitsBudget: 9_000 },
      },
    );
  });

  it('changes only the quota on a repeat poll, with no event-log row', () => {
    // Arrange: the healthy source and its snapshot.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyYouTubeSource()],
      dataSnapshots: [buildSnapshotWithCarnaubasSuperChat()],
    });

    // Act: a good poll with the same Super Chat, 5 units later.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'recordDataSourcePoll',
        sourceId: 'youtube-enduro',
        result: {
          ok: true,
          shapes: buildSnapshotWithCarnaubasSuperChat().shapes,
          receivedAtMs: momentOfTheCommandMs,
          youTubeQuota: { unitsSpentToday: 11, dailyUnitsBudget: 9_000 },
        },
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: the units moved, the snapshot did not, and the row is left out of the log.
    expect(outcome, 'the repeat must change the quota only, unlogged').toMatchObject({
      status: 'applied',
      isLeftOutOfTheEventLog: true,
      slices: {
        dataSources: [{ status: { youTubeQuota: { unitsSpentToday: 11 } } }],
        dataSnapshots: [buildSnapshotWithCarnaubasSuperChat()],
      },
    });
  });
});
