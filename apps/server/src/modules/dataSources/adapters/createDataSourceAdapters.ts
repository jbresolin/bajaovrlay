// The adapters the server knows, one per kind of source, and the one function that
// polls a source with the adapter of its kind.
import type { DataSource, ReplayConfig, SimulatorConfig } from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  DataSourceAdapter,
  DataSourcePollContext,
  PolledShapes,
} from './dataSourceAdapter.js';

/**
 * The adapter of each kind. A kind may be missing (none is registered yet, or a test
 * leaves it out): polling such a source fails with a pt-BR error instead of crashing.
 */
export type DataSourceAdapters = {
  simulator?: DataSourceAdapter<SimulatorConfig> | undefined;
  replay?: DataSourceAdapter<ReplayConfig> | undefined;
};

/**
 * Builds the adapters the running server uses. No adapter is registered yet; the replay
 * and simulator adapters are added here, and until then an enabled source fails its
 * polls with noAdapterForKind ("O servidor ainda não sabe ler fontes do tipo …").
 */
export function createDataSourceAdapters(): DataSourceAdapters {
  return {};
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
  }
}

/** A rejected poll saying, in pt-BR, that the server cannot read this kind of source. */
function rejectForAKindWithNoAdapter(kind: DataSource['kind']): Promise<PolledShapes> {
  return Promise.reject(new Error(ptBR.dataSourceErrors.noAdapterForKind(kind)));
}
