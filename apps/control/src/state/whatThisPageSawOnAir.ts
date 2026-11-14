import type {
  CommandInput,
  InstanceIdSeenOnAir,
  InstanceIdsSeenOnAirByLayer,
  Slices,
} from '@bajaovrlay/shared';

/** The slices the page reads to say what it showed on air. */
type SlicesThePageShows = Pick<
  Slices,
  'instances' | 'items' | 'rundowns' | 'previewClearedLayerIds'
>;

/**
 * The command with what this page showed on air on the layer it takes on (BAJAOVRLAY-69),
 * read from the store at the moment it is sent: `takeItem` (a rundown row's "Disparar", a
 * quick-fire button or its number key, "Salvar e disparar", a Camadas row's "Disparar"), `takeNext`
 * (Space) and `takePreview` ("Tomar", Space on a previewed item) carry the instance on
 * program of their layer, or null for an empty one, and `takeNext` the cursor item it showed
 * as well (gate 2 of PR #64); `takeAllPreviews` ("Tomar tudo") carries
 * one per layer it takes. The server refuses a take only when another console changed that
 * layer less than 2 s ago and this page had not shown it yet. Every other command is sent
 * as it is.
 * It is added here, in the page's one way of sending, rather than at each button, so no
 * take path, today's or a later one, can forget it. A take whose layer the page cannot find
 * (an item or a cursor it does not know) is sent as it is, and the server answers it.
 */
export function addWhatThisPageSawOnAir(
  command: CommandInput,
  slicesNow: SlicesThePageShows,
): CommandInput {
  switch (command.type) {
    case 'takeItem': {
      const layerId = findLayerOfItem(command.itemId, slicesNow);
      if (layerId === undefined) {
        return command;
      }
      return { ...command, instanceIdSeenOnAir: findInstanceIdOnProgram(layerId, slicesNow) };
    }
    case 'takeNext': {
      const rundown = slicesNow.rundowns.find((candidate) => candidate.id === command.rundownId);
      const cursorItemId = rundown?.cursorItemId ?? null;
      const layerId = cursorItemId === null ? undefined : findLayerOfItem(cursorItemId, slicesNow);
      if (cursorItemId === null || layerId === undefined) {
        return command;
      }
      // The cursor item goes too: the server takes at its own cursor, and refuses the press
      // when that is another item now, since what the page saw was about this one.
      return {
        ...command,
        cursorItemIdSeen: cursorItemId,
        instanceIdSeenOnAir: findInstanceIdOnProgram(layerId, slicesNow),
      };
    }
    case 'takePreview':
      return {
        ...command,
        instanceIdSeenOnAir: findInstanceIdOnProgram(command.layerId, slicesNow),
      };
    case 'takeAllPreviews':
      return { ...command, instanceIdsSeenOnAir: listWhatEachLayerInPreviewShowsOnAir(slicesNow) };
    default:
      return command;
  }
}

/** The layer an item goes on, or undefined when the page does not know the item. */
function findLayerOfItem(itemId: string, slicesNow: SlicesThePageShows): string | undefined {
  return slicesNow.items.find((item) => item.id === itemId)?.layerId;
}

/** The id of the instance the page shows on the program output of a layer, or null. */
function findInstanceIdOnProgram(
  layerId: string,
  slicesNow: SlicesThePageShows,
): InstanceIdSeenOnAir {
  const instanceOnProgram = slicesNow.instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
  return instanceOnProgram?.id ?? null;
}

/** For each layer Prévia shows something on (a preview or "vai limpar"), what is on air there. */
function listWhatEachLayerInPreviewShowsOnAir(
  slicesNow: SlicesThePageShows,
): InstanceIdsSeenOnAirByLayer {
  const layerIdsInPreview = [
    ...slicesNow.instances
      .filter((instance) => instance.target === 'preview')
      .map((instance) => instance.layerId),
    ...slicesNow.previewClearedLayerIds,
  ];
  const instanceIdsSeenOnAir: InstanceIdsSeenOnAirByLayer = {};
  for (const layerId of layerIdsInPreview) {
    instanceIdsSeenOnAir[layerId] = findInstanceIdOnProgram(layerId, slicesNow);
  }
  return instanceIdsSeenOnAir;
}
