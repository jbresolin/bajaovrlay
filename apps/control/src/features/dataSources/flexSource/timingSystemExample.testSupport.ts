// Test support: the example preset of the flex source (packages/shared/src/flexMapping/
// examples), an imaginary timing system with 20 fictional cars, as the flex form's tests
// paste, import and store it. The config is read through the shared schema, as the
// server stores it; every builder returns new objects, so no test can change another's.
import {
  type HttpJsonConfig,
  HttpJsonConfigSchema,
  type HttpJsonDataSource,
} from '@bajaovrlay/shared';

import exampleConfigFile from '../../../../../../packages/shared/src/flexMapping/examples/timing-system-like.config.json';
import exampleResponseFile from '../../../../../../packages/shared/src/flexMapping/examples/timing-system-like.response.json';

/** The id the server gave the flex source an operator made from the example. */
export const timingSystemSourceId = 'cronometragem-exemplo';

/** The example config as the server stores it: parsed by HttpJsonConfigSchema. */
export function readExampleTimingSystemConfig(): HttpJsonConfig {
  return HttpJsonConfigSchema.parse(structuredClone(exampleConfigFile));
}

/**
 * The example config with every mapping's rules listed last to first, as someone might
 * write them by hand or through REST: the same config, in another order than the form's.
 */
export function readExampleTimingSystemConfigWithRulesReversed(): HttpJsonConfig {
  const config = readExampleTimingSystemConfig();
  for (const mapping of config.mappings) {
    mapping.fields.reverse();
    // The session mapping has no item rules; only positions and standings do.
    if (mapping.entryFields !== undefined) {
      mapping.entryFields.reverse();
    }
  }
  return config;
}

/** The example config as text, as an operator pastes it into "Importar configuração". */
export function readExampleTimingSystemConfigText(): string {
  return JSON.stringify(exampleConfigFile, null, 2);
}

/** The example response, a fresh copy a test may change (a broken lap time, say). */
export function readExampleTimingSystemResponse(): {
  classificacao: Record<string, unknown>[];
} & Record<string, unknown> {
  return structuredClone(exampleResponseFile);
}

/** The example response as text, as an operator pastes it into the "Testar" panel. */
export function readExampleTimingSystemResponseText(): string {
  return JSON.stringify(exampleResponseFile, null, 2);
}

/**
 * The flex source made from the example, off, as the server sends it in `dataSources`;
 * its config is the example's unless a test gives another.
 */
export function buildTimingSystemSourceThatIsOff(
  config: HttpJsonConfig = readExampleTimingSystemConfig(),
): HttpJsonDataSource {
  return {
    id: timingSystemSourceId,
    label: 'Cronometragem — exemplo',
    kind: 'httpJson',
    config,
    pollIntervalMs: 2_000,
    isEnabled: false,
    isRecording: false,
    status: {
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 6_000,
      recordingError: null,
    },
  };
}
