import type { Command } from '@bajaovrlay/shared';

import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * Shows why the last command failed, when it was one of `commandTypes`. Each part of
 * the page places one next to its own buttons (takes under the take form, clears next
 * to the layers), so a failure appears where the operator was looking. The text is the
 * server's pt-BR message, or the catalog's for a timeout or a missing connection. It
 * stays until a later command succeeds.
 */
export function CommandErrorMessage(props: { commandTypes: Command['type'][] }) {
  const lastCommandError = useServerState((state) => state.lastCommandError);

  const isAboutTheseCommands =
    lastCommandError !== null && props.commandTypes.includes(lastCommandError.commandType);
  if (!isAboutTheseCommands) {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-destructive">
      {lastCommandError.message}
    </p>
  );
}
