import type { Command } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceDeleteEntity } from './deleteEntity.js';
import { reduceImportEntities } from './importEntities.js';
import { reduceUpsertEntity } from './upsertEntity.js';

/** The commands of the entity module, one reducer file each. */
export type EntityCommand = Extract<
  Command,
  { type: 'upsertEntity' | 'deleteEntity' | 'importEntities' }
>;

/** Sends an entity command to its reducer; core's reduceCommand calls this. */
export function reduceEntityCommand(
  slices: SlicesChangedByCommands,
  command: EntityCommand,
): ReducerOutcome {
  switch (command.type) {
    case 'upsertEntity':
      return reduceUpsertEntity(slices, command);
    case 'deleteEntity':
      return reduceDeleteEntity(slices, command);
    case 'importEntities':
      return reduceImportEntities(slices, command);
  }
}
