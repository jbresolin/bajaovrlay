// The refusals of the data-source commands, each with its stable code and pt-BR message,
// like core/store/quickFireAndMacroRefusals.ts for the macro commands.
import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/** The refusal for a command naming a data source that does not exist. */
export function refuseUnknownDataSource(sourceId: string): CommandError {
  return {
    code: 'DATA_SOURCE_NOT_FOUND',
    message: ptBR.dataSourceErrors.dataSourceNotFound(sourceId),
  };
}

/**
 * The refusal for a config that fails the schema of its kind, naming the first bad field
 * as the operator's form knows it: `config.carCount`, or `config` for the whole thing.
 */
export function refuseInvalidDataSourceConfig(
  badFieldPathInsideConfig: PropertyKey[],
): CommandError {
  const fieldPath = ['config', ...badFieldPathInsideConfig.map(String)].join('.');
  return {
    code: 'INVALID_DATA_SOURCE_CONFIG',
    message: ptBR.dataSourceErrors.invalidConfigField(fieldPath),
  };
}

/** The refusal for "Atualizar agora" or "Gravar" on a source that is off. */
export function refuseDisabledDataSource(sourceLabel: string): CommandError {
  return {
    code: 'DATA_SOURCE_DISABLED',
    message: ptBR.dataSourceErrors.dataSourceDisabled(sourceLabel),
  };
}

/** The refusal for a replay of a recording that does not exist or is still open. */
export function refuseUnknownRecording(recordingId: string): CommandError {
  return {
    code: 'RECORDING_NOT_FOUND',
    message: ptBR.dataSourceErrors.recordingNotFound(recordingId),
  };
}
