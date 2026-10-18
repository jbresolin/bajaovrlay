import type { DataSource, DataSourceKind } from '@bajaovrlay/shared';
import { useState } from 'react';

import { useSendCommand } from '@/state/ControlPageStateProvider';

import {
  buildCreateDataSourceCommand,
  buildUpdateDataSourceCommand,
  type DataSourceFormReading,
} from './dataSourceCommandsFromForm';

/** What the save needs to know about the form it serves. */
export type SaveDataSourceOptions = {
  kind: DataSourceKind;
  /** The stored source the form was opened on, or null for "+ Fonte". */
  sourceAsOpened: DataSource | null;
  /** Called once the server accepted, or when there was nothing to send. */
  onSaved: () => void;
};

/**
 * The save of both source forms: sends createDataSource for a new source, or
 * updateDataSource with only the changes for a stored one, and calls `onSaved` once the
 * server accepts (the form then closes). A refusal leaves the form open, and
 * `wasLastSaveRefused` tells the form to show the reason (CommandErrorMessage).
 * `isWaitingForTheServer` keeps the button off meanwhile.
 *
 * Why the form needs `wasLastSaveRefused`: the page's `lastCommandError` stays until a
 * later command succeeds, so a form opened after a refused save of another form (closed
 * with "Cancelar") would otherwise show that refusal as its own before sending anything.
 */
export function useSaveDataSource(options: SaveDataSourceOptions) {
  const sendCommand = useSendCommand();
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const [wasLastSaveRefused, setWasLastSaveRefused] = useState(false);

  async function saveFormReading(reading: DataSourceFormReading): Promise<void> {
    const command =
      options.sourceAsOpened === null
        ? buildCreateDataSourceCommand(options.kind, reading)
        : buildUpdateDataSourceCommand(options.sourceAsOpened, reading);
    if (command === undefined) {
      options.onSaved();
      return;
    }

    setIsWaitingForTheServer(true);
    setWasLastSaveRefused(false);
    try {
      const wasAccepted = await sendCommand(command);
      if (wasAccepted) {
        options.onSaved();
      } else {
        setWasLastSaveRefused(true);
      }
    } finally {
      setIsWaitingForTheServer(false);
    }
  }

  return { saveFormReading, isWaitingForTheServer, wasLastSaveRefused };
}
