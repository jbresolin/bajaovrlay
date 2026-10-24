import type { Command } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceDeleteMedia } from './deleteMedia.js';
import { reduceRecordUploadedMedia } from './recordUploadedMedia.js';

/** The commands of the media module, one reducer file each. */
export type MediaCommand = Extract<Command, { type: 'recordUploadedMedia' | 'deleteMedia' }>;

/** Sends a media command to its reducer; core's reduceCommand calls this. */
export function reduceMediaCommand(
  slices: SlicesChangedByCommands,
  command: MediaCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'recordUploadedMedia':
      return reduceRecordUploadedMedia(slices, command, context);
    case 'deleteMedia':
      return reduceDeleteMedia(slices, command);
  }
}
