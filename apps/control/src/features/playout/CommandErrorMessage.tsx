import type { Command } from '@bajaovrlay/shared';

import type { AreaOfThePage, LastCommandError } from '@/state/commandFailure';
import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * Shows why the last command failed, when it was one of `commandTypes`. Each part of
 * the page places one next to its own buttons (takes under the take form, clears next
 * to the layers), so a failure appears where the operator was looking. The text is the
 * server's pt-BR message, or the catalog's for a timeout or a missing connection, with a
 * line per layer under it when there are some (a "Tomar tudo" that left layers another
 * console had just changed, BAJAOVRLAY-69). It stays until a later command succeeds, so
 * the operator has all the time needed to read it.
 * `areaOfThePage` names this part when another part lists the same types (the rundown
 * column and the quick-fire strip both send `takeItem`): a failure whose sender said where
 * it was sent from is shown in that part only, once.
 */
export function CommandErrorMessage(props: {
  commandTypes: Command['type'][];
  areaOfThePage?: AreaOfThePage;
}) {
  const lastCommandError = useServerState((state) => state.lastCommandError);

  if (lastCommandError === null || !isShownHere(lastCommandError, props)) {
    return null;
  }
  const sentenceOfEachLayer = lastCommandError.sentenceOfEachLayer ?? [];
  return (
    <div role="alert" className="text-sm text-destructive">
      <p>{lastCommandError.message}</p>
      {sentenceOfEachLayer.length === 0 ? null : (
        <ul className="list-disc pl-5">
          {sentenceOfEachLayer.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Whether this part shows the failure: it is of one of its types, and, when both the
 * failure and this part name an area, the same area.
 */
function isShownHere(
  lastCommandError: LastCommandError,
  props: { commandTypes: Command['type'][]; areaOfThePage?: AreaOfThePage },
): boolean {
  const isOfTheseTypes = props.commandTypes.includes(lastCommandError.commandType);
  if (!isOfTheseTypes) {
    return false;
  }
  const isAreaNamedByBoth =
    lastCommandError.areaOfThePage !== undefined && props.areaOfThePage !== undefined;
  if (!isAreaNamedByBoth) {
    return true;
  }
  return lastCommandError.areaOfThePage === props.areaOfThePage;
}
