// The adapters the server knows, one per kind of source, and the one function that
// polls a source with the adapter of its kind.
import type {
  DataSource,
  HttpJsonConfig,
  ReplayConfig,
  SimulatorConfig,
  YouTubeQuotaUsage,
} from '@bajaovrlay/shared';

import type { ServerLogger } from '../../../core/logger/createLogger.js';
import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  DataSourceAdapter,
  DataSourcePollContext,
  PolledShapes,
} from './dataSourceAdapter.js';
import { createHttpJsonAdapter } from './httpJson/httpJsonAdapter.js';
import {
  type ReadEnvironmentVariable,
  readServerEnvironmentVariable,
} from './httpJson/httpJsonRequestAddress.js';
import { noSourceHostAllowlist, type SourceHostAllowlist } from './httpJson/sourceHostAllowlist.js';
import { createReplayAdapter } from './replay/replayAdapter.js';
import { createSimulatorAdapter } from './simulator/simulatorAdapter.js';
import { youTubeDataApiBaseUrl } from './youtubeLiveChat/youTubeApiRequests.js';
import {
  createYouTubeLiveChatAdapter,
  type YouTubeLiveChatAdapter,
} from './youtubeLiveChat/youTubeLiveChatAdapter.js';
import { openYouTubeQuotaLedger } from './youtubeLiveChat/youTubeQuotaLedger.js';

/**
 * The adapter of each kind. A kind may be missing (none is registered yet, or a test
 * leaves it out): polling such a source fails with a pt-BR error instead of crashing.
 */
export type DataSourceAdapters = {
  simulator?: DataSourceAdapter<SimulatorConfig> | undefined;
  replay?: DataSourceAdapter<ReplayConfig> | undefined;
  httpJson?: DataSourceAdapter<HttpJsonConfig> | undefined;
  youtubeLiveChat?: YouTubeLiveChatAdapter | undefined;
};

/**
 * What the adapters need from the server: where the recordings are (the replay), the
 * logger, the environment variables and the list of allowed hosts (the flex HTTP/JSON
 * source).
 */
export type DataSourceAdaptersOptions = {
  /** `<DATA_DIR>/recordings`, which the replay adapter reads recordings from. */
  recordingsFolder: string;
  logger: ServerLogger;
  /** Tests hand in a table; the server's own process.env, read at each poll, otherwise. */
  readSourceEnvironmentVariable?: ReadEnvironmentVariable | undefined;
  /** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot; no list when left out. */
  sourceHostAllowlist?: SourceHostAllowlist | undefined;
  /**
   * `<DATA_DIR>/youtube-quota.json`, where the YouTube key's units spent today are kept
   * across restarts; left out (tests), the count lives in memory only.
   */
  youTubeQuotaLedgerPath?: string | undefined;
  /** The YouTube Data API's address; tests point it at a local fake. */
  youTubeApiBaseUrl?: string | undefined;
};

/**
 * Builds the adapters the running server uses: the race simulator, the replay, httpJson
 * and the YouTube live chat.
 */
export function createDataSourceAdapters(options: DataSourceAdaptersOptions): DataSourceAdapters {
  const readEnvironmentVariable =
    options.readSourceEnvironmentVariable ?? readServerEnvironmentVariable;
  return {
    simulator: createSimulatorAdapter(),
    replay: createReplayAdapter({ recordingsFolder: options.recordingsFolder }),
    httpJson: createHttpJsonAdapter({
      logger: options.logger,
      readEnvironmentVariable,
      sourceHostAllowlist: options.sourceHostAllowlist ?? noSourceHostAllowlist,
    }),
    youtubeLiveChat: createYouTubeLiveChatAdapter({
      ledger: openYouTubeQuotaLedger({
        ledgerFilePath: options.youTubeQuotaLedgerPath,
        logger: options.logger,
      }),
      logger: options.logger,
      readEnvironmentVariable,
      youTubeApiBaseUrl: options.youTubeApiBaseUrl ?? youTubeDataApiBaseUrl,
    }),
  };
}

/**
 * Polls a source once with the adapter of its kind. The switch keeps each kind's config
 * paired with its own adapter. A kind with no adapter rejects with a pt-BR error, which
 * the poller records as a failed poll like any other.
 */
export function pollDataSourceWithTheAdapterOfItsKind(
  source: DataSource,
  adapters: DataSourceAdapters,
  context: DataSourcePollContext,
): Promise<PolledShapes> {
  switch (source.kind) {
    case 'simulator': {
      const adapter = adapters.simulator;
      if (adapter === undefined) {
        return rejectForAKindWithNoAdapter(source.kind);
      }
      return adapter.pollOnce(source.config, context);
    }
    case 'replay': {
      const adapter = adapters.replay;
      if (adapter === undefined) {
        return rejectForAKindWithNoAdapter(source.kind);
      }
      return adapter.pollOnce(source.config, context);
    }
    case 'httpJson': {
      const adapter = adapters.httpJson;
      if (adapter === undefined) {
        return rejectForAKindWithNoAdapter(source.kind);
      }
      return adapter.pollOnce(source.config, context);
    }
    case 'youtubeLiveChat': {
      const adapter = adapters.youtubeLiveChat;
      if (adapter === undefined) {
        return rejectForAKindWithNoAdapter(source.kind);
      }
      return adapter.pollOnce(source.config, context);
    }
  }
}

/**
 * The YouTube key's quota spent today, for a poll result of a YouTube source, or
 * undefined for every other kind (and when no YouTube adapter is registered).
 */
export function readYouTubeQuotaUsageForTheSource(
  source: DataSource,
  adapters: DataSourceAdapters,
  nowMs: number,
): YouTubeQuotaUsage | undefined {
  if (source.kind !== 'youtubeLiveChat') {
    return undefined;
  }
  return adapters.youtubeLiveChat?.readQuotaUsage(nowMs);
}

/** A rejected poll saying, in pt-BR, that the server cannot read this kind of source. */
function rejectForAKindWithNoAdapter(kind: DataSource['kind']): Promise<PolledShapes> {
  return Promise.reject(new Error(ptBR.dataSourceErrors.noAdapterForKind(kind)));
}

/**
 * Starts the preparation of a source with the adapter of its kind (prepareForPolling),
 * when that adapter has one. A kind with no adapter, or an adapter with nothing to
 * prepare, does nothing: its polls say what is wrong. Returns at once.
 */
export function prepareDataSourceWithTheAdapterOfItsKind(
  source: DataSource,
  adapters: DataSourceAdapters,
): void {
  switch (source.kind) {
    case 'simulator': {
      adapters.simulator?.prepareForPolling?.(source.config);
      return;
    }
    case 'replay': {
      adapters.replay?.prepareForPolling?.(source.config);
      return;
    }
    case 'httpJson': {
      adapters.httpJson?.prepareForPolling?.(source.config);
      return;
    }
    case 'youtubeLiveChat': {
      adapters.youtubeLiveChat?.prepareForPolling?.(source.config);
      return;
    }
  }
}
