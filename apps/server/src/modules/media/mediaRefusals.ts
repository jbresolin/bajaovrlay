// The refusals of the media commands, each with its stable code and pt-BR message, like
// modules/dataSources/dataSourceRefusals.ts for the data-source commands.
import type { CommandError, MediaUse } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/** The refusal for a record naming an image the store does not hold, field first. */
export function refuseMediaNotInTheStore(fieldLabel: string): CommandError {
  return { code: 'MEDIA_NOT_FOUND', message: ptBR.mediaErrors.mediaNotInTheStore(fieldLabel) };
}

/** The refusal for deleting an image some records still use, each use named. */
export function refuseMediaInUse(fileName: string, uses: MediaUse[]): CommandError {
  const usesAsText = uses.map((use) =>
    ptBR.mediaErrors.oneUse(use.recordDescription, use.fieldLabel),
  );
  return { code: 'MEDIA_IN_USE', message: ptBR.mediaErrors.mediaInUse(fileName, usesAsText) };
}
